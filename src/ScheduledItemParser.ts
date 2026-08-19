import { unwrapMarkdownLinkLabel } from "./InboxMarkdown.ts";
import type { EventOccurrenceStatus, ScheduledItem, ScheduledItemSource, TaskPriority } from "./ScheduledItemTypes";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export class ScheduledItemParser {
    parseLine(line: string, ctx: ScheduledItemSource): ScheduledItem | null {
        return this.parseEventLine(line, ctx) ?? this.parseTaskLine(line, ctx);
    }

    private parseEventLine(line: string, ctx: ScheduledItemSource): ScheduledItem | null {
        const match = line.match(
            /^-\s+(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\s+-\s+((?:\d{4}-\d{2}-\d{2} )?\d{2}:\d{2})\s+(.+)$/,
        );
        if (match) {
            const start = this.parseDateTime(match[1]);
            const end = start ? this.parseEventEnd(match[2], start) : null;
            if (!start || !end || end <= start) return null;
            return this.buildEventItem(match[3], start, end, false, ctx, line);
        }

        const allDayMatch = line.match(/^-\s+(\d{4}-\d{2}-\d{2})\s+(.+)$/);
        if (!allDayMatch) return null;
        const start = this.parseDate(allDayMatch[1]);
        if (!start) return null;
        const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
        return this.buildEventItem(allDayMatch[2], start, end, true, ctx, line);
    }

    private buildEventItem(
        payload: string,
        start: Date,
        end: Date,
        allDay: boolean,
        ctx: ScheduledItemSource,
        rawLine: string,
    ): ScheduledItem | null {
        const parts = payload.split(" | ").map((part) => part.trim());
        const title = this.cleanTitle(parts.shift() ?? "");
        if (!title) return null;
        const metadata = this.parseEventMetadata(parts);
        if (!metadata) return null;
        if (allDay && (!metadata.explicitEvent || !metadata.allDay)) return null;
        if (!allDay && metadata.allDay) return null;

        return {
            id: this.buildItemId(ctx),
            kind: "event",
            title,
            start,
            end,
            due: null,
            dueHasTime: false,
            remind: null,
            priority: null,
            eventStatus: metadata.status,
            actualStart: metadata.actualStart,
            actualEnd: metadata.actualEnd,
            allDay,
            isCompleted: metadata.status === "completed",
            source: ctx,
            rawLine,
        };
    }

    private parseEventMetadata(parts: string[]): {
        status: EventOccurrenceStatus;
        actualStart: Date | null;
        actualEnd: Date | null;
        explicitEvent: boolean;
        allDay: boolean;
    } | null {
        let status: EventOccurrenceStatus = "planned";
        let actualStart: Date | null = null;
        let actualEnd: Date | null = null;
        let explicitEvent = false;
        let allDay = false;
        const seen = new Set<string>();
        for (const part of parts) {
            const separator = part.indexOf(":");
            if (separator === -1) continue;
            const key = part.slice(0, separator).trim().toLowerCase();
            const value = part.slice(separator + 1).trim();
            if (!["status", "actual-start", "actual-end", "type", "all-day"].includes(key)) continue;
            if (seen.has(key)) return null;
            seen.add(key);
            if (key === "status") {
                const normalized = value.toLowerCase();
                if (normalized !== "planned" && normalized !== "completed" && normalized !== "cancelled") return null;
                status = normalized;
            }
            if (key === "actual-start") actualStart = this.parseDateTime(value);
            if (key === "actual-end") actualEnd = this.parseDateTime(value);
            if (key === "type") explicitEvent = value.toLowerCase() === "event";
            if (key === "all-day") allDay = value.toLowerCase() === "true";
        }
        if (seen.has("type") && !explicitEvent) return null;
        if (seen.has("all-day") && !allDay) return null;
        if (Boolean(actualStart) !== Boolean(actualEnd)) return null;
        if ((actualStart || actualEnd) && status !== "completed") return null;
        if (actualStart && actualEnd && actualEnd <= actualStart) return null;
        return { status, actualStart, actualEnd, explicitEvent, allDay };
    }

    private parseTaskLine(line: string, ctx: ScheduledItemSource): ScheduledItem | null {
        const match = line.match(/^-\s+\[( |x|X)\]\s+(.+)$/);
        if (!match) return null;

        const parts = match[2].split("|").map((part) => part.trim());
        const title = this.cleanTitle(parts.shift() ?? "");
        if (!title) return null;

        const metadata = this.parseTaskMetadata(parts);
        return {
            id: this.buildItemId(ctx),
            kind: "task",
            title,
            start: metadata.start,
            end: metadata.end,
            due: metadata.due,
            dueHasTime: metadata.dueHasTime,
            remind: metadata.remind,
            priority: metadata.priority,
            eventStatus: null,
            actualStart: null,
            actualEnd: null,
            allDay: false,
            isCompleted: match[1].toLowerCase() === "x",
            source: ctx,
            rawLine: line,
        };
    }

    private parseTaskMetadata(parts: string[]): {
        due: Date | null;
        remind: Date | null;
        start: Date | null;
        end: Date | null;
        dueHasTime: boolean;
        priority: TaskPriority;
    } {
        const result = {
            due: null as Date | null,
            remind: null as Date | null,
            start: null as Date | null,
            end: null as Date | null,
            dueHasTime: false,
            priority: "normal" as TaskPriority,
        };
        let priorityCount = 0;

        for (const part of parts) {
            const separator = part.indexOf(":");
            if (separator === -1) continue;

            const key = part.slice(0, separator).trim().toLowerCase();
            const value = part.slice(separator + 1).trim();
            if (key === "due") {
                const due = this.parseDateOrDateTime(unwrapMarkdownLinkLabel(value));
                result.due = due.date;
                result.dueHasTime = due.hasTime;
            }
            if (key === "remind") result.remind = this.parseDateTime(unwrapMarkdownLinkLabel(value));
            if (key === "start") result.start = this.parseDateTime(unwrapMarkdownLinkLabel(value));
            if (key === "end") result.end = this.parseDateTime(unwrapMarkdownLinkLabel(value));
            if (key === "priority") {
                priorityCount += 1;
                result.priority = this.parseTaskPriority(value);
            }
        }

        if (priorityCount > 1) result.priority = "normal";

        return result;
    }

    private parseTaskPriority(value: string): TaskPriority {
        const normalized = value.toLowerCase();
        return normalized === "high" || normalized === "medium" || normalized === "low" || normalized === "normal"
            ? normalized
            : "normal";
    }

    private parseDateOrDateTime(value: string): { date: Date | null; hasTime: boolean } {
        const dateTime = this.parseDateTime(value);
        if (dateTime) return { date: dateTime, hasTime: true };
        return { date: this.parseDate(value), hasTime: false };
    }

    private parseDate(value: string): Date | null {
        if (!DATE_RE.test(value)) return null;
        const [year, month, day] = value.split("-").map(Number);
        const date = new Date(year, month - 1, day);
        return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
    }

    private parseDateTime(value: string): Date | null {
        const match = value.match(DATETIME_RE);
        if (!match) return null;
        const date = this.parseDate(match[1]);
        if (!date) return null;
        const [hour, minute] = match[2].split(":").map(Number);
        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
        return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute);
    }

    private parseEventEnd(value: string, start: Date): Date | null {
        if (TIME_RE.test(value)) {
            const day = this.formatDate(start);
            return this.parseDateTime(`${day} ${value}`);
        }
        return this.parseDateTime(value);
    }

    private buildItemId(ctx: ScheduledItemSource): string {
        return `${ctx.filePath}:${ctx.lineNumber}`;
    }

    private cleanTitle(value: string): string {
        return value
            .trim()
            .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
            .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
            .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
            .replace(/\[\[([^\]]+)\]\]/g, "$1")
            .replace(/\.md\b/g, "")
            .trim();
    }

    private formatDate(date: Date): string {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    }
}
