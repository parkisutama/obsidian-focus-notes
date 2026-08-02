export type InboxTriggerKind = "mention" | "tag";

export interface InboxTrigger {
    kind: InboxTriggerKind;
    start: number;
    end: number;
    query: string;
}

export interface TrackedMentionLink {
    filePath: string;
    label: string;
    markdown: string;
}

export type MentionLinkFormatter = (
    targetFilePath: string,
    linkedFilePath: string,
    label: string
) => string;

export function findInboxTrigger(text: string, cursor: number): InboxTrigger | null {
    if (cursor < 0 || cursor > text.length) return null;
    const beforeCursor = text.slice(0, cursor);
    const match = beforeCursor.match(/([@#])([^\s@#]*)$/);
    if (!match || match.index === undefined) return null;
    const start = match.index;
    const boundary = start === 0 ? "" : beforeCursor[start - 1];
    if (boundary && !/[\s([{,;:!?]/.test(boundary)) return null;

    return {
        kind: match[1] === "@" ? "mention" : "tag",
        start,
        end: cursor,
        query: match[2]
    };
}

export function replaceInboxTextRange(
    text: string,
    range: Pick<InboxTrigger, "start" | "end">,
    replacement: string
): string {
    return `${text.slice(0, range.start)}${replacement}${text.slice(range.end)}`;
}

export function rebaseTrackedMentionLinks(
    text: string,
    mentions: TrackedMentionLink[],
    previousTargetFile: string,
    nextTargetFile: string,
    formatLink: MentionLinkFormatter
): { text: string; mentions: TrackedMentionLink[] } {
    if (previousTargetFile === nextTargetFile) return { text, mentions: [...mentions] };
    let updatedText = text;
    const updatedMentions = mentions.map(mention => {
        const markdown = formatLink(
            nextTargetFile,
            mention.filePath,
            mention.label
        );
        updatedText = updatedText.split(mention.markdown).join(markdown);
        return { ...mention, markdown };
    });
    return { text: updatedText, mentions: updatedMentions };
}
