import type { ScheduledItem, ScheduledItemFocusSession } from "../../capture/scheduled-item/domain/ScheduledItem.ts";
import type { TaskTimeboxStatus } from "../../capture/scheduled-item/domain/TaskTimebox.ts";
import type { FocusUtilizationSummary } from "../../focus-session/domain/FocusUtilization.ts";

export interface ScheduledItemFocusTimebox {
    start: Date;
    end: Date;
    status: TaskTimeboxStatus;
}

/**
 * Task 61: one owner-level planned-versus-focused summary across ALL of an Event's or Task's
 * direct Focus Sessions, replacing the one-Timebox-to-one-session pairing `FocusUtilization` did
 * before direct ownership (Task 53). A Task's planned time is every non-cancelled Timebox
 * (skipped/completed still count — only cancelled is excluded); an Event's planned time is its
 * own interval, or zero when all-day or missing a schedule. Works with zero planned time: an
 * unplanned Task, or one with only cancelled Timeboxes, still reports its logged focused time.
 */
export function summarizeScheduledItemFocus(
    item: Pick<ScheduledItem, "kind" | "start" | "end" | "allDay">,
    timeboxes: readonly ScheduledItemFocusTimebox[],
    sessions: readonly Pick<ScheduledItemFocusSession, "durationSeconds">[],
): FocusUtilizationSummary {
    const plannedSeconds = item.kind === "task" ? plannedTaskSeconds(timeboxes) : plannedEventSeconds(item);
    return {
        plannedSeconds,
        focusedSeconds: sessions.reduce((sum, session) => sum + session.durationSeconds, 0),
        sessionCount: sessions.length,
    };
}

function plannedTaskSeconds(timeboxes: readonly ScheduledItemFocusTimebox[]): number {
    return timeboxes
        .filter((timebox) => timebox.status !== "cancelled")
        .reduce((sum, timebox) => sum + intervalSeconds(timebox.start, timebox.end), 0);
}

function plannedEventSeconds(item: Pick<ScheduledItem, "start" | "end" | "allDay">): number {
    if (item.allDay || !item.start || !item.end) return 0;
    return intervalSeconds(item.start, item.end);
}

function intervalSeconds(start: Date, end: Date): number {
    return Math.max(0, (end.getTime() - start.getTime()) / 1000);
}
