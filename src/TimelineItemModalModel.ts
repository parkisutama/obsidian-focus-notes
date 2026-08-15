import type { ScheduledItem } from "./ScheduledItemTypes";

export interface TimelineItemModalModel {
    title: string;
    kindLabel: "Event" | "Task";
    canEdit: boolean;
    statusLabel: "Scheduled" | "Pending" | "Completed" | "Cancelled";
    priorityLabel: "High" | "Medium" | "Normal" | "Low" | null;
    scheduleLabel: string;
    actualScheduleLabel: string | null;
    sourceLabel: string;
    sourcePath: string;
}

export interface PendingTaskModalItemModel {
    item: ScheduledItem;
    meta: string;
}

export interface PendingTaskModalModel {
    title: string;
    subtitle: string;
    items: PendingTaskModalItemModel[];
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
});
const TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
});

export function buildTimelineItemModalModel(item: ScheduledItem): TimelineItemModalModel {
    const heading = item.source.headingPath.join(" › ");
    return {
        title: item.title,
        kindLabel: item.kind === "event" ? "Event" : "Task",
        canEdit: item.kind === "task",
        statusLabel: formatStatus(item),
        priorityLabel: item.kind === "task" ? formatPriority(item.priority ?? "normal") : null,
        scheduleLabel: formatSchedule(item),
        actualScheduleLabel:
            item.kind === "event" && item.actualStart && item.actualEnd
                ? formatInterval(item.actualStart, item.actualEnd)
                : null,
        sourceLabel: [item.source.fileName, heading, `Line ${item.source.lineNumber}`].filter(Boolean).join(" · "),
        sourcePath: item.source.filePath,
    };
}

function formatStatus(item: ScheduledItem): "Scheduled" | "Pending" | "Completed" | "Cancelled" {
    if (item.kind === "task") return item.isCompleted ? "Completed" : "Pending";
    if (item.eventStatus === "completed") return "Completed";
    if (item.eventStatus === "cancelled") return "Cancelled";
    return "Scheduled";
}

function formatPriority(priority: "high" | "medium" | "normal" | "low"): "High" | "Medium" | "Normal" | "Low" {
    return `${priority.charAt(0).toUpperCase()}${priority.slice(1)}` as "High" | "Medium" | "Normal" | "Low";
}

export function buildPendingTaskModalModel(items: ScheduledItem[], now = new Date()): PendingTaskModalModel {
    return {
        title: "Pending tasks",
        subtitle: `${items.length} incomplete ${items.length === 1 ? "task" : "tasks"}`,
        items: items.map((item) => ({ item, meta: formatPendingMeta(item, now) })),
    };
}

function formatSchedule(item: ScheduledItem): string {
    if (item.allDay && item.start) return `All day · ${DATE_FORMAT.format(item.start)}`;
    if (item.start && item.end) {
        return formatInterval(item.start, item.end);
    }
    if (item.start) return `${DATE_FORMAT.format(item.start)} · ${TIME_FORMAT.format(item.start)}`;
    if (item.due) {
        const time = item.dueHasTime ? ` · ${TIME_FORMAT.format(item.due)}` : "";
        return `Due ${DATE_FORMAT.format(item.due)}${time}`;
    }
    if (item.remind) return `Reminder ${DATE_FORMAT.format(item.remind)} · ${TIME_FORMAT.format(item.remind)}`;
    return "No schedule";
}

function formatInterval(start: Date, end: Date): string {
    const endDate = DATE_FORMAT.format(end) === DATE_FORMAT.format(start) ? "" : `${DATE_FORMAT.format(end)} · `;
    return `${DATE_FORMAT.format(start)} · ${TIME_FORMAT.format(start)}–${endDate}${TIME_FORMAT.format(end)}`;
}

function formatPendingMeta(item: ScheduledItem, now: Date): string {
    const anchor = item.due ?? item.end ?? item.start ?? item.remind;
    if (!anchor) return item.source.fileName;

    const anchorDay = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days = Math.max(1, Math.round((today.getTime() - anchorDay.getTime()) / 86400000));
    const relative = days === 1 ? "Yesterday" : `${days} days ago`;
    return `${relative} · ${DATE_FORMAT.format(anchor)} · ${item.source.fileName}`;
}
