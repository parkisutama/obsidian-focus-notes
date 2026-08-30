import { createPlannedTaskTimebox } from "../domain/TaskTimeboxLine.ts";
import type { TaskTimebox, TaskTimeboxStatus, TaskTimeboxWarning } from "../domain/TaskTimebox.ts";

export type { TaskTimeboxWarning } from "../domain/TaskTimebox.ts";
export { cancelPlannedTimeboxesForTaskCompletion } from "../domain/TaskTimebox.ts";

export interface TaskTimeboxInterval {
    start: string;
    end: string;
}

export interface TaskTimeboxContext {
    /** The owning Task's due date, or null when the Task has no due date. */
    due: { date: string; hasTime: boolean } | null;
}

export type AddTaskTimeboxResult =
    | { status: "added"; timeboxes: TaskTimebox[]; timebox: TaskTimebox; warnings: TaskTimeboxWarning[] }
    | { status: "invalid"; reason: "invalid-interval" };

export type EditTaskTimeboxResult =
    | { status: "edited"; timeboxes: TaskTimebox[]; warnings: TaskTimeboxWarning[] }
    | { status: "invalid"; reason: "invalid-interval" }
    | { status: "not-found" };

export type SetTaskTimeboxStatusResult = { status: "updated"; timeboxes: TaskTimebox[] } | { status: "not-found" };

export type DeleteTaskTimeboxResult =
    | { status: "deleted"; timeboxes: TaskTimebox[] }
    | { status: "requires-confirmation" }
    | { status: "not-found" };

/** Adds a new planned timebox, warning (never blocking) on same-Task overlap or after-due scheduling. */
export function addTaskTimebox(
    timeboxes: readonly TaskTimebox[],
    interval: TaskTimeboxInterval,
    context: TaskTimeboxContext,
    createTimeboxId?: () => string,
): AddTaskTimeboxResult {
    if (!isValidInterval(interval)) return { status: "invalid", reason: "invalid-interval" };
    const timebox = createPlannedTaskTimebox(interval.start, interval.end, createTimeboxId);
    return {
        status: "added",
        timeboxes: [...timeboxes, timebox],
        timebox,
        warnings: warningsFor(timebox, timeboxes, context),
    };
}

/** Edits an existing timebox's interval in place; `timeboxId` never changes. */
export function editTaskTimebox(
    timeboxes: readonly TaskTimebox[],
    timeboxId: string,
    interval: TaskTimeboxInterval,
    context: TaskTimeboxContext,
): EditTaskTimeboxResult {
    const existing = timeboxes.find((t) => t.timeboxId === timeboxId);
    if (!existing) return { status: "not-found" };
    if (!isValidInterval(interval)) return { status: "invalid", reason: "invalid-interval" };

    const edited: TaskTimebox = { ...existing, start: interval.start, end: interval.end };
    const others = timeboxes.filter((t) => t.timeboxId !== timeboxId);
    return {
        status: "edited",
        timeboxes: mergeById(timeboxes, edited),
        warnings: warningsFor(edited, others, context),
    };
}

export function setTaskTimeboxStatus(
    timeboxes: readonly TaskTimebox[],
    timeboxId: string,
    status: TaskTimeboxStatus,
): SetTaskTimeboxStatusResult {
    const existing = timeboxes.find((t) => t.timeboxId === timeboxId);
    if (!existing) return { status: "not-found" };
    return { status: "updated", timeboxes: mergeById(timeboxes, { ...existing, status }) };
}

/**
 * Removes one timebox. Planned timeboxes with no logged history delete on request; anything else
 * — completed/skipped/cancelled (historical) status, or a still-planned timebox that already has
 * logged Focus Sessions attached — requires the caller to pass `confirmedHistorical: true` for an
 * explicit destructive action, per the spec's safe-delete rule. Deleting removes that history too
 * (a timebox and its attached sessions are one unit), so this is the one guard against losing it
 * by accident.
 */
export function deleteTaskTimebox(
    timeboxes: readonly TaskTimebox[],
    timeboxId: string,
    options: { confirmedHistorical?: boolean; hasFocusSessions?: boolean } = {},
): DeleteTaskTimeboxResult {
    const existing = timeboxes.find((t) => t.timeboxId === timeboxId);
    if (!existing) return { status: "not-found" };
    const needsConfirmation = existing.status !== "planned" || Boolean(options.hasFocusSessions);
    if (needsConfirmation && !options.confirmedHistorical) return { status: "requires-confirmation" };
    return { status: "deleted", timeboxes: timeboxes.filter((t) => t.timeboxId !== timeboxId) };
}

function mergeById(timeboxes: readonly TaskTimebox[], updated: TaskTimebox): TaskTimebox[] {
    return timeboxes.map((t) => (t.timeboxId === updated.timeboxId ? updated : t));
}

function isValidInterval(interval: TaskTimeboxInterval): boolean {
    const start = parseLocal(interval.start);
    const end = parseLocal(interval.end);
    return start !== null && end !== null && end > start;
}

function warningsFor(
    candidate: TaskTimebox,
    others: readonly TaskTimebox[],
    context: TaskTimeboxContext,
): TaskTimeboxWarning[] {
    const warnings: TaskTimeboxWarning[] = [];
    const candidateStart = parseLocal(candidate.start);
    const candidateEnd = parseLocal(candidate.end);
    for (const other of others) {
        if (other.status === "cancelled") continue;
        const otherStart = parseLocal(other.start);
        const otherEnd = parseLocal(other.end);
        if (!candidateStart || !candidateEnd || !otherStart || !otherEnd) continue;
        if (candidateStart < otherEnd && candidateEnd > otherStart) {
            warnings.push({ type: "overlap", withTimeboxId: other.timeboxId });
        }
    }
    if (context.due && candidateStart) {
        const due = parseLocal(context.due.date);
        if (due) {
            const afterDue = context.due.hasTime ? candidateStart > due : dayKey(candidateStart) > dayKey(due);
            if (afterDue) warnings.push({ type: "after-due", due: context.due.date });
        }
    }
    return warnings;
}

function dayKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Duplicated (see TaskTimeboxLine.ts) rather than imported, to avoid coupling this pure
// application service to ScheduledItemFormAdapter.ts's wider import graph.
function parseLocal(value: string): Date | null {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?$/);
    if (!match) return null;
    const [year, month, day, hour, minute] = [match[1], match[2], match[3], match[4] ?? "0", match[5] ?? "0"].map(
        Number,
    );
    return new Date(year, month - 1, day, hour, minute);
}
