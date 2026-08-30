export type InsertScheduledItemChildResult = { status: "inserted"; content: string } | { status: "anchor-not-found" };

/**
 * Inserts a new child line one indent level deeper than the line ending in `^anchorBlockId`,
 * after any of that line's existing descendants (deeper-indented lines already nested under it) —
 * the same "append as last child" placement Task 33/34 use for timeboxes, generalized so Task 43's
 * focus-session lines can nest under either an Event's own line or one of its Task's timebox lines
 * without a second bespoke tree-walker. `buildLine` receives the computed indent so the caller
 * never has to guess the anchor's depth.
 */
export function insertScheduledItemChildLine(
    content: string,
    anchorBlockId: string,
    buildLine: (indent: string) => string,
): InsertScheduledItemChildResult {
    const trailing = new RegExp(`\\^${anchorBlockId}\\s*$`);
    const lineEnding = content.includes("\r\n") ? "\r\n" : "\n";
    let searchFrom = 0;

    for (let index = 0; index <= content.length; index += 1) {
        if (index !== content.length && content[index] !== "\n") continue;
        const hasCarriageReturn = index > searchFrom && content[index - 1] === "\r";
        const contentEndOffset = hasCarriageReturn ? index - 1 : index;
        const line = content.slice(searchFrom, contentEndOffset);

        if (trailing.test(line)) {
            const anchorIndent = line.match(/^[\t ]*/)?.[0].length ?? 0;
            const anchorLineEnd = index === content.length ? index : index + 1;
            let insertAt = anchorLineEnd;
            let scanFrom = anchorLineEnd;

            while (scanFrom < content.length) {
                let lineEndIdx = content.indexOf("\n", scanFrom);
                if (lineEndIdx === -1) lineEndIdx = content.length;
                const hasCr = lineEndIdx > scanFrom && content[lineEndIdx - 1] === "\r";
                const rawLine = content.slice(scanFrom, hasCr ? lineEndIdx - 1 : lineEndIdx);
                if (rawLine.trim() === "") break;
                const indent = rawLine.match(/^[\t ]*/)?.[0].length ?? 0;
                if (indent <= anchorIndent) break;
                insertAt = lineEndIdx === content.length ? lineEndIdx : lineEndIdx + 1;
                scanFrom = insertAt;
            }

            const childLine = buildLine(`${" ".repeat(anchorIndent + 2)}`);
            const needsLeadingNewline =
                insertAt === content.length && content.length > 0 && !content.endsWith(lineEnding);
            const insertion = needsLeadingNewline
                ? `${lineEnding}${childLine}${lineEnding}`
                : `${childLine}${lineEnding}`;
            return { status: "inserted", content: content.slice(0, insertAt) + insertion + content.slice(insertAt) };
        }

        searchFrom = index + 1;
    }

    return { status: "anchor-not-found" };
}
