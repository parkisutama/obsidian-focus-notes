import { editTaskLine, parseTaskLineEdit } from "./TaskLineEditor.ts";
import type { TaskTimebox } from "./TaskTimebox.ts";
import { createPlannedTaskTimebox } from "./TaskTimeboxLine.ts";

export type MigrateLegacyTaskTimeboxResult =
    | { status: "unchanged" }
    | { status: "migrated"; firstLine: string; timebox: TaskTimebox }
    | { status: "invalid" };

/**
 * Losslessly migrates a Task's legacy single-line `start`/`end` fields into one child timebox.
 * Idempotent: a Task that already has any child timebox (migrated already, or independently
 * authored) is left exactly as-is, so re-running migration never creates a second timebox from
 * the same legacy fields.
 */
export function migrateLegacyTaskTimebox(
    firstLine: string,
    existingTimeboxes: readonly TaskTimebox[],
    createTimeboxId?: () => string,
): MigrateLegacyTaskTimeboxResult {
    if (existingTimeboxes.length > 0) return { status: "unchanged" };
    const parsed = parseTaskLineEdit(firstLine);
    if (parsed.status === "invalid") return { status: "invalid" };
    if (!parsed.edit.timebox) return { status: "unchanged" };

    const timebox = createPlannedTaskTimebox(parsed.edit.timebox.start, parsed.edit.timebox.end, createTimeboxId);
    const nextLine = editTaskLine(firstLine, { ...parsed.edit, timebox: null });
    if (nextLine.status === "invalid") return { status: "invalid" };
    return { status: "migrated", firstLine: nextLine.line, timebox };
}
