export type InboxTriggerKind = "mention" | "tag";

export interface InboxTrigger {
    kind: InboxTriggerKind;
    start: number;
    end: number;
    query: string;
}

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
