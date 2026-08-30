/**
 * Removes the one line ending in `^blockId` from `content`, including its own line terminator,
 * preserving every other line's exact bytes (CRLF or LF). Returns `content` unchanged when the
 * block id isn't present, so callers can treat removal as an idempotent no-op — safe to retry
 * against a file that already converged, or one where the reference was already cleaned up.
 */
export function removeMarkdownLineWithBlockId(content: string, blockId: string): string {
    const trailing = new RegExp(`\\^${blockId}\\s*$`);
    let searchFrom = 0;
    for (let index = 0; index <= content.length; index += 1) {
        if (index !== content.length && content[index] !== "\n") continue;
        const contentEndOffset = index > searchFrom && content[index - 1] === "\r" ? index - 1 : index;
        const line = content.slice(searchFrom, contentEndOffset);
        if (trailing.test(line)) {
            const lineEndWithTerminator = index === content.length ? index : index + 1;
            return content.slice(0, searchFrom) + content.slice(lineEndWithTerminator);
        }
        searchFrom = index + 1;
    }
    return content;
}
