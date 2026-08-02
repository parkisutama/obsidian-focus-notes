export type InboxRichTextPart =
    | { kind: "text"; value: string }
    | { kind: "link"; label: string; filePath: string };

export function isInboxLineBreakInput(inputType: string): boolean {
    return inputType === "insertParagraph" || inputType === "insertLineBreak";
}

export function parseInboxRichText(
    markdown: string,
    resolveDestination: (destination: string) => string | null
): InboxRichTextPart[] {
    const parts: InboxRichTextPart[] = [];
    const pattern = /\[((?:\\.|[^\]])+)\]\(([^)\n]+)\)/g;
    let cursor = 0;
    let match: RegExpExecArray | null;
    const pushText = (value: string): void => {
        if (!value) return;
        const previous = parts[parts.length - 1];
        if (previous?.kind === "text") previous.value += value;
        else parts.push({ kind: "text", value });
    };

    while ((match = pattern.exec(markdown)) !== null) {
        if (match.index > cursor) pushText(markdown.slice(cursor, match.index));
        const filePath = resolveDestination(match[2]);
        if (filePath) {
            parts.push({
                kind: "link",
                label: match[1].replace(/\\([\[\]\\])/g, "$1"),
                filePath
            });
        } else {
            pushText(match[0]);
        }
        cursor = pattern.lastIndex;
    }

    if (cursor < markdown.length) pushText(markdown.slice(cursor));
    return parts;
}

export function serializeInboxRichText(
    parts: InboxRichTextPart[],
    targetFile: string,
    formatLink: (targetFile: string, filePath: string, label: string) => string
): string {
    return parts.map(part => part.kind === "text"
        ? part.value
        : formatLink(targetFile, part.filePath, part.label)
    ).join("");
}
