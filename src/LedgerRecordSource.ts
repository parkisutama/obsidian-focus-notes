export interface LedgerRecordSource {
    filePath: string;
    lineNumber: number;
    rawLine: string;
}

export interface LedgerRecordSnapshot extends LedgerRecordSource {
    rawBlock: string;
    startOffset: number;
    endOffset: number;
}

type ConflictReason = "line-missing" | "line-changed" | "block-changed" | "ambiguous";

export type CaptureLedgerRecordResult =
    | { status: "captured"; snapshot: LedgerRecordSnapshot }
    | { status: "conflict"; reason: "line-missing" | "line-changed" };

export type ReplaceLedgerRecordResult =
    | { status: "ready"; content: string }
    | { status: "conflict"; reason: ConflictReason };

interface SourceLine {
    content: string;
    startOffset: number;
    contentEndOffset: number;
}

function splitSourceLines(content: string): SourceLine[] {
    const lines: SourceLine[] = [];
    let startOffset = 0;

    for (let index = 0; index <= content.length; index += 1) {
        if (index !== content.length && content[index] !== "\n") continue;

        const hasCarriageReturn = index > startOffset && content[index - 1] === "\r";
        const contentEndOffset = hasCarriageReturn ? index - 1 : index;
        lines.push({
            content: content.slice(startOffset, contentEndOffset),
            startOffset,
            contentEndOffset,
        });
        startOffset = index + 1;
    }

    return lines;
}

function captureAtLine(content: string, source: LedgerRecordSource): CaptureLedgerRecordResult {
    const line = splitSourceLines(content)[source.lineNumber - 1];
    if (line === undefined) return { status: "conflict", reason: "line-missing" };
    if (line.content !== source.rawLine) return { status: "conflict", reason: "line-changed" };

    const lines = splitSourceLines(content);
    let endOffset = line.contentEndOffset;
    for (let index = source.lineNumber; index < lines.length; index += 1) {
        const candidate = lines[index];
        if (candidate.content.length === 0) continue;
        if (!/^[\t ]/.test(candidate.content)) break;
        endOffset = candidate.contentEndOffset;
    }

    return {
        status: "captured",
        snapshot: {
            ...source,
            rawBlock: content.slice(line.startOffset, endOffset),
            startOffset: line.startOffset,
            endOffset,
        },
    };
}

export function captureLedgerRecord(content: string, source: LedgerRecordSource): CaptureLedgerRecordResult {
    return captureAtLine(content, source);
}

export function replaceLedgerRecord(
    content: string,
    snapshot: LedgerRecordSnapshot,
    newFirstLine: string,
): ReplaceLedgerRecordResult {
    const occurrences = content.split(snapshot.rawBlock).length - 1;
    if (occurrences > 1) return { status: "conflict", reason: "ambiguous" };

    const current = captureAtLine(content, snapshot);
    if (current.status === "conflict") return current;
    if (current.snapshot.rawBlock !== snapshot.rawBlock) {
        return { status: "conflict", reason: "block-changed" };
    }

    const nestedContent = current.snapshot.rawBlock.slice(snapshot.rawLine.length);
    return {
        status: "ready",
        content:
            content.slice(0, current.snapshot.startOffset) +
            newFirstLine +
            nestedContent +
            content.slice(current.snapshot.endOffset),
    };
}
