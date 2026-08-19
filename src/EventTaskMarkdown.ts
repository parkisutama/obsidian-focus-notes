import type { EventRecord, EventTaskRecord, HubNoteRef, TaskRecord } from "./EventTaskWriter";
import { formatRelativeMarkdownLink } from "./InboxMarkdown.ts";
import type { TaskPriority } from "./ScheduledItemTypes";

/** Resolves the vault path of the daily note covering `when`, or null if none is configured. */
export type ResolveDailyLinkPath = (when: Date) => string | null;

export function formatEventTaskEntry(
    record: EventTaskRecord,
    detailNoteRef?: HubNoteRef | null,
    targetFilePath?: string,
    resolveDailyPath?: ResolveDailyLinkPath,
): string {
    const line =
        record.kind === "event" ? formatEventLine(record) : formatTaskLine(record, targetFilePath, resolveDailyPath);
    const parts = [line];
    for (const descriptionLine of record.description.split(/\r?\n/)) {
        const description = descriptionLine.trim();
        if (description) parts.push(`    - ${description}`);
    }
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

function formatTaskLine(record: TaskRecord, targetFilePath?: string, resolveDailyPath?: ResolveDailyLinkPath): string {
    const title = record.hubNoteRef ? `[${record.title}](${encodePath(record.hubNoteRef.path)})` : record.title;
    let line = `- [ ] ${title}`;
    if (record.priority !== "normal") line += ` | priority:${record.priority}`;
    const dateLink = (when: Date, label: string): string => {
        const dailyPath = resolveDailyPath?.(when);
        return dailyPath && targetFilePath ? formatRelativeMarkdownLink(targetFilePath, dailyPath, label) : label;
    };
    if (record.due) {
        const label = record.dueHasTime ? formatDateTime(record.due) : formatDate(record.due);
        line += ` | due:${dateLink(record.due, label)}`;
    }
    if (record.timebox) {
        line += ` | start:${dateLink(record.timebox.start, formatDateTime(record.timebox.start))}`;
        line += ` | end:${dateLink(record.timebox.end, formatDateTime(record.timebox.end))}`;
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
