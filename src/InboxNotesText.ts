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
        query: match[2],
    };
}

/** Keep the caret in editable text after inserting a non-editable live link. */
export function suggestionSeparator(text: string, replacedUntil: number): string {
    const nextCharacter = text[replacedUntil] ?? "";
    return nextCharacter && /\s/.test(nextCharacter) ? "" : " ";
}

/** Matches the indent the Task block editor writes to disk for nested description lines. */
export const LIST_INDENT = "    ";

/** Offsets of the start of every line the [start, end] range touches, in ascending order. */
export function lineStartOffsets(text: string, start: number, end: number): number[] {
    const starts = [text.lastIndexOf("\n", Math.max(0, start - 1)) + 1];
    let next = text.indexOf("\n", starts[0]);
    while (next !== -1 && next < end) {
        starts.push(next + 1);
        next = text.indexOf("\n", next + 1);
    }
    return starts;
}

export function leadingIndentLength(text: string, lineStart: number): number {
    let count = 0;
    while (count < LIST_INDENT.length && (text[lineStart + count] === " " || text[lineStart + count] === "\t")) {
        count += 1;
    }
    return count;
}
