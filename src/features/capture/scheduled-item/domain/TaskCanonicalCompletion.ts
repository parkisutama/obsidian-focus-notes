import { editTaskLine, parseTaskLineEdit } from "./TaskLineEditor.ts";
import { cancelPlannedTimeboxesForTaskCompletion, type TaskTimebox } from "./TaskTimebox.ts";

export interface CanonicalTaskCompletionChange {
    firstLine: string;
    timeboxes: TaskTimebox[];
}

/**
 * Applies a completion command to a canonical Task's first line, driven by a reference checkbox
 * toggle. Returns null when the line can't be parsed or the canonical already matches (a stale
 * or duplicate toggle), so callers never perform a no-op or corrupting write.
 *
 * Completing cancels every still-planned timebox (Task 34's rule); un-completing never restores
 * them automatically — that stays an explicit Timebox Manager action.
 */
export function applyCanonicalTaskCompletion(
    firstLine: string,
    timeboxes: readonly TaskTimebox[],
    completed: boolean,
): CanonicalTaskCompletionChange | null {
    const parsed = parseTaskLineEdit(firstLine);
    if (parsed.status === "invalid") return null;
    if (parsed.edit.completed === completed) return null;

    const edited = editTaskLine(firstLine, { ...parsed.edit, completed });
    if (edited.status === "invalid") return null;

    return {
        firstLine: edited.line,
        timeboxes: completed ? cancelPlannedTimeboxesForTaskCompletion(timeboxes) : [...timeboxes],
    };
}
