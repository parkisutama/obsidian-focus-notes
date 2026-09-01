import type { EventRecord, EventTaskRecord, HubNoteRef, TaskRecord } from "./EventTaskRecord";
import type { TaskPriority } from "./ScheduledItem";
import { appendScheduledItemBlockId } from "./ScheduledItemBlockId.ts";
import { formatDescriptionLine, formatReflectionNotesLine } from "../../shared/domain/FlatBlockChildLine.ts";
import { formatReflectionLabelLine, reflectionFieldsPresent } from "../../../reflection/domain/ReflectionBlockLine.ts";
import { createPlannedTaskTimebox, formatTaskTimeboxLine } from "./TaskTimeboxLine.ts";

/** Formats a date value as a link (or plain text, if unresolvable) for a Task date field. */
export type FormatDateLink = (when: Date, label: string) => string;

export function formatEventTaskEntry(
    record: EventTaskRecord,
    detailNoteRef?: HubNoteRef | null,
    formatDateLink?: FormatDateLink,
    blockId?: string,
    timeboxId?: string,
): string {
    const semanticLine = record.kind === "event" ? formatEventLine(record) : formatTaskLine(record, formatDateLink);
    const line = blockId ? appendScheduledItemBlockId(semanticLine, blockId) : semanticLine;
    const parts = [line];
    const description = formatDescriptionLine("    ", record.description);
    if (description) parts.push(description);
    if (record.kind === "task" && record.timebox) {
        if (!timeboxId) throw new Error("Canonical Task timebox requires a timebox block ID.");
        parts.push(
            formatTaskTimeboxLine(
                createPlannedTaskTimebox(
                    formatDateTime(record.timebox.start),
                    formatDateTime(record.timebox.end),
                    () => timeboxId,
                ),
            ),
        );
    }
    if (record.reflection && reflectionFieldsPresent(record.reflection)) {
        parts.push(formatReflectionLabelLine("    ", record.reflection));
    }
    const reflectionNotes = formatReflectionNotesLine("    ", record.reflectionNotes ?? "");
    if (reflectionNotes) parts.push(reflectionNotes);
    if (detailNoteRef) {
        parts.push(`    - detail: [${detailNoteRef.title}](${encodePath(detailNoteRef.path)})`);
    }
    return parts.join("\n");
}

export function formatTaskPriorityFrontmatter(priority: TaskPriority, enabled: boolean): string | null {
    return enabled ? `priority: ${priority}` : null;
}

function formatEventLine(record: EventRecord): string {
    const title = record.hubNoteRef ? `[${record.title}](${encodePath(record.hubNoteRef.path)})` : record.title;
    let line = record.allDay
        ? `- ${formatDate(record.start)} ${title} | type:event | all-day:true`
        : `- ${formatDateTime(record.start)} - ${formatEventEnd(record.start, record.end)} ${title}`;
    if (record.status !== "planned") line += ` | status:${record.status}`;
    if (record.actualStart && record.actualEnd) {
        line += ` | actual-start:${formatDateTime(record.actualStart)}`;
        line += ` | actual-end:${formatDateTime(record.actualEnd)}`;
    }
    return line;
}

function formatTaskLine(record: TaskRecord, formatDateLink?: FormatDateLink): string {
    const title = record.hubNoteRef ? `[${record.title}](${encodePath(record.hubNoteRef.path)})` : record.title;
    let line = `- [ ] ${title}`;
    if (record.priority !== "normal") line += ` | priority:${record.priority}`;
    const dateLink = (when: Date, label: string): string => (formatDateLink ? formatDateLink(when, label) : label);
    if (record.due) {
        const label = record.dueHasTime ? formatDateTime(record.due) : formatDate(record.due);
        line += ` | due:${dateLink(record.due, label)}`;
    }
    for (const reminder of record.reminders) {
        line += ` | remind:${dateLink(reminder, formatDateTime(reminder))}`;
    }
    return line;
}

function encodePath(path: string): string {
    return path.replace(/ /g, "%20");
}

function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function formatTime(date: Date): string {
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatDateTime(date: Date): string {
    return `${formatDate(date)} ${formatTime(date)}`;
}

function formatEventEnd(start: Date, end: Date): string {
    return formatDate(start) === formatDate(end) ? formatTime(end) : formatDateTime(end);
}
