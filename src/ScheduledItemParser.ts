import { ScheduledItem, ScheduledItemSource } from "./ScheduledItemTypes";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export class ScheduledItemParser {
    parseLine(line: string, ctx: ScheduledItemSource): ScheduledItem | null {
        return this.parseEventLine(line, ctx) ?? this.parseTaskLine(line, ctx);
    }

    private parseEventLine(line: string, ctx: ScheduledItemSource): ScheduledItem | null {
        const match = line.match(
            /^-\s+(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\s+-\s+((?:\d{4}-\d{2}-\d{2} )?\d{2}:\d{2})\s+(.+)$/
        );
        if (!match) return null;

        const start = this.parseDateTime(match[1]);
        const end = start ? this.parseEventEnd(match[2], start) : null;
        const title = this.cleanTitle(match[3]);
        if (!start || !end || !title || end <= start) return null;

        return {
            id: this.buildItemId(ctx),
            kind: "event",
            title,
            start,
            end,
            due: null,
            dueHasTime: false,
            remind: null,
            isCompleted: false,
            source: ctx,
            rawLine: line
        };
    }

    private parseTaskLine(line: string, ctx: ScheduledItemSource): ScheduledItem | null {
        const match = line.match(/^-\s+\[( |x|X)\]\s+(.+)$/);
        if (!match) return null;

        const parts = match[2].split("|").map(part => part.trim());
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
            isCompleted: match[1].toLowerCase() === "x",
            source: ctx,
            rawLine: line
        };
    }

    private parseTaskMetadata(parts: string[]): {
        due: Date | null;
        remind: Date | null;
        start: Date | null;
        end: Date | null;
        dueHasTime: boolean;
    } {
        const result = {
            due: null as Date | null,
            remind: null as Date | null,
            start: null as Date | null,
            end: null as Date | null,
            dueHasTime: false
        };

        for (const part of parts) {
            const separator = part.indexOf(":");
            if (separator === -1) continue;

            const key = part.slice(0, separator).trim().toLowerCase();
            const value = part.slice(separator + 1).trim();
            if (key === "due") {
                const due = this.parseDateOrDateTime(value);
                result.due = due.date;
                result.dueHasTime = due.hasTime;
            }
            if (key === "remind") result.remind = this.parseDateTime(value);
            if (key === "start") result.start = this.parseDateTime(value);
            if (key === "end") result.end = this.parseDateTime(value);
        }

        return result;
    }

    private parseDateOrDateTime(value: string): { date: Date | null; hasTime: boolean } {
        const dateTime = this.parseDateTime(value);
        if (dateTime) return { date: dateTime, hasTime: true };
        return { date: this.parseDate(value), hasTime: false };
    }

    private parseDate(value: string): Date | null {
        if (!DATE_RE.test(value)) return null;
        const date = new Date(`${value}T00:00:00`);
        return isNaN(date.getTime()) ? null : date;
    }

    private parseDateTime(value: string): Date | null {
        const match = value.match(DATETIME_RE);
        if (!match) return null;
        const date = new Date(`${match[1]}T${match[2]}:00`);
        return isNaN(date.getTime()) ? null : date;
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
