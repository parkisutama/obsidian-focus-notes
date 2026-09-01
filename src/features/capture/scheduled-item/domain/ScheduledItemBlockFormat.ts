import { canonicalizeScheduledItemBlock } from "./ScheduledItemBlockEditor.ts";
import { captureLedgerRecord, replaceLedgerRecordBlock } from "./LedgerRecordSource.ts";
import { inspectTaskLine } from "./TaskLineLint.ts";

export type ScheduledItemBlockFormatPlan =
    | { status: "unchanged" }
    | { status: "needs-format"; normalizedBlock: string }
    | { status: "invalid" };

/**
 * Classifies whether a Scheduled Item block already matches the approved flat grammar
 * (Task 47-53's keyed prefixes, canonical child order, Task Focus Sessions as direct siblings)
 * or still carries one of the unreleased development shapes `ScheduledItemBlockEditor` tolerantly
 * reads, or an unordered `| key:value` Task metadata first line (`TaskLineLint`'s concern). Both
 * normalizations are combined into one block-wide change so a single vault write can never leave
 * a Task's first line and its children out of sync. Re-running this on `normalizedBlock` always
 * reports "unchanged".
 */
export function planScheduledItemBlockFormat(rawBlock: string): ScheduledItemBlockFormatPlan {
    const lines = rawBlock.split(/\r?\n/);
    const firstLine = lines[0] ?? "";
    const lineInspection = inspectTaskLine(firstLine);
    const normalizedFirstLine =
        lineInspection.status === "needs-format" && lineInspection.normalizedLine
            ? lineInspection.normalizedLine
            : firstLine;
    const candidateBlock = [normalizedFirstLine, ...lines.slice(1)].join(detectLineEnding(rawBlock));

    const canonical = canonicalizeScheduledItemBlock(candidateBlock);
    if (canonical === null) return { status: "invalid" };
    return canonical === rawBlock ? { status: "unchanged" } : { status: "needs-format", normalizedBlock: canonical };
}

function detectLineEnding(value: string): "\r\n" | "\n" {
    return value.includes("\r\n") ? "\r\n" : "\n";
}

export interface ScheduledItemBlockFormatChange {
    lineNumber: number;
    rawLine: string;
    normalizedBlock: string;
}

export type ApplyScheduledItemBlockFormatChangesResult =
    | { status: "ready"; content: string }
    | { status: "conflict" | "ambiguous"; lineNumber: number };

/**
 * Applies every planned block change to `content` in one pass, all-or-nothing: the first stale
 * or ambiguous source aborts before any write, same contract as `applyTaskFormatChanges`. Safe to
 * sequence with a prior line-only pass (identity insertion) because neither pass changes line
 * counts, so every change's captured `lineNumber` stays valid throughout.
 */
export function applyScheduledItemBlockFormatChanges(
    content: string,
    filePath: string,
    changes: readonly ScheduledItemBlockFormatChange[],
): ApplyScheduledItemBlockFormatChangesResult {
    let working = content;
    for (const change of changes) {
        const captured = captureLedgerRecord(working, {
            filePath,
            lineNumber: change.lineNumber,
            rawLine: change.rawLine,
        });
        if (captured.status === "conflict") return { status: "conflict", lineNumber: change.lineNumber };
        const replaced = replaceLedgerRecordBlock(working, captured.snapshot, change.normalizedBlock);
        if (replaced.status === "conflict") {
            return {
                status: replaced.reason === "ambiguous" ? "ambiguous" : "conflict",
                lineNumber: change.lineNumber,
            };
        }
        working = replaced.content;
    }
    return { status: "ready", content: working };
}
