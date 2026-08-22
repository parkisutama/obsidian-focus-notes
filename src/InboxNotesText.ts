import type { ScheduledItemKind } from "./ScheduledItemTypes.ts";

export type InboxTriggerKind = "mention" | "tag" | "scheduled-item";

export interface InboxTrigger {
    kind: InboxTriggerKind;
    itemKind?: ScheduledItemKind;
    start: number;
    end: number;
    query: string;
}

export function findInboxTrigger(text: string, cursor: number): InboxTrigger | null {
    if (cursor < 0 || cursor > text.length) return null;
    const beforeCursor = text.slice(0, cursor);
    // Object Note titles routinely contain spaces ("IAT ISSUE TRACKER"), so a
    // mention query stays open across them and only ends at a line break, a
    // new trigger character, or the user backspacing out of it. Tags can't
    // contain spaces, so a tag query still ends at the first one.
    const match = beforeCursor.match(/@([^\n@#]*)$/) ?? beforeCursor.match(/#([^\s@#]*)$/);
    if (!match || match.index === undefined) return null;
    const start = match.index;
    const boundary = start === 0 ? "" : beforeCursor[start - 1];
    if (boundary && !/[\s([{,;:!?]/.test(boundary)) return null;

    const scheduled = match[0].match(/^@(task|event)(?:\s+(.*))?$/i);
    if (scheduled) {
        return {
            kind: "scheduled-item",
            itemKind: scheduled[1].toLowerCase() as ScheduledItemKind,
            start,
            end: cursor,
            query: scheduled[2] ?? "",
        };
    }
    return {
        kind: beforeCursor[start] === "@" ? "mention" : "tag",
        start,
        end: cursor,
        query: match[1],
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
