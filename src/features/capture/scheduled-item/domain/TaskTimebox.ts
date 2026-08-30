export type TaskTimeboxStatus = "planned" | "completed" | "skipped" | "cancelled";

export interface TaskTimebox {
    timeboxId: string;
    start: string;
    end: string;
    status: TaskTimeboxStatus;
}

export const TASK_TIMEBOX_STATUSES: readonly TaskTimeboxStatus[] = ["planned", "completed", "skipped", "cancelled"];

export type TaskTimeboxWarning = { type: "overlap"; withTimeboxId: string } | { type: "after-due"; due: string };

/**
 * Completing a Task cancels every still-planned timebox while leaving historical (completed,
 * skipped, already-cancelled) timeboxes and their Focus Sessions untouched. Completing a
 * timebox never completes its Task — this is the inverse direction only.
 */
export function cancelPlannedTimeboxesForTaskCompletion(timeboxes: readonly TaskTimebox[]): TaskTimebox[] {
    return timeboxes.map((t) => (t.status === "planned" ? { ...t, status: "cancelled" } : t));
}
