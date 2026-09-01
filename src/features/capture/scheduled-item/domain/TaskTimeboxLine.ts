import {
    classifyScheduledItemBlockId,
    createDerivedBlockId,
    extractScheduledItemBlockId,
} from "./ScheduledItemBlockId.ts";
import { TASK_TIMEBOX_STATUSES, type TaskTimebox, type TaskTimeboxStatus } from "./TaskTimebox.ts";

export type TaskTimeboxLineInvalidReason = "invalid-interval" | "invalid-status" | "missing-id";

// Duplicated rather than imported from ScheduledItemFormAdapter.ts: that module imports
// ScheduledItemBlockEditor.ts, which imports this module, so sharing it would cycle.
function parseLocalDateTime(value: string, allowDateOnly: boolean): Date | null {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?$/);
    if (!match || (!allowDateOnly && match[4] === undefined)) return null;
    const [year, month, day, hour, minute] = [match[1], match[2], match[3], match[4] ?? "0", match[5] ?? "0"].map(
        Number,
    );
    const result = new Date(year, month - 1, day, hour, minute);
    return result.getFullYear() === year &&
        result.getMonth() === month - 1 &&
        result.getDate() === day &&
        result.getHours() === hour &&
        result.getMinutes() === minute
        ? result
        : null;
}

export type ParseTaskTimeboxLineResult =
    | { status: "parsed"; timebox: TaskTimebox }
    | { status: "invalid"; reason: TaskTimeboxLineInvalidReason }
    | { status: "not-timebox" };

const TIMEBOX_RE = /^-\s+timebox:\s*start:(.+?)\s*\|\s*end:(.+?)\s*\|\s*status:(.+?)$/;

/** Renders a Task's planned work interval as an identified child line, per the spec's timebox grammar. */
export function formatTaskTimeboxLine(timebox: TaskTimebox, indent = "    "): string {
    return `${indent}- timebox: start:${timebox.start} | end:${timebox.end} | status:${timebox.status} ^${timebox.timeboxId}`;
}

export function parseTaskTimeboxLine(line: string): ParseTaskTimeboxLineResult {
    const { semanticLine, blockId } = extractScheduledItemBlockId(line);
    const match = semanticLine.trim().match(TIMEBOX_RE);
    if (!match) return { status: "not-timebox" };
    if (!blockId || classifyScheduledItemBlockId(blockId) !== "timebox")
        return { status: "invalid", reason: "missing-id" };

    const [, start, end, status] = match;
    if (!TASK_TIMEBOX_STATUSES.includes(status as TaskTimeboxStatus)) {
        return { status: "invalid", reason: "invalid-status" };
    }
    const parsedStart = parseLocalDateTime(start, false);
    const parsedEnd = parseLocalDateTime(end, false);
    if (!parsedStart || !parsedEnd || parsedEnd <= parsedStart) {
        return { status: "invalid", reason: "invalid-interval" };
    }

    return { status: "parsed", timebox: { timeboxId: blockId, start, end, status: status as TaskTimeboxStatus } };
}

export function createPlannedTaskTimebox(
    start: string,
    end: string,
    createTimeboxId: () => string = () => createDerivedBlockId("timebox"),
): TaskTimebox {
    return { timeboxId: createTimeboxId(), start, end, status: "planned" };
}
