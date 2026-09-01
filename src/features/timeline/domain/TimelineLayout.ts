import type { ScheduledItem } from "../../capture/scheduled-item/domain/ScheduledItem";
import {
    type FocusUtilizationSummary,
    summarizeFocusUtilization,
} from "../../focus-session/domain/FocusUtilization.ts";
import type { TimelineRange } from "./Timeline";
import { addDays, endOfDay, formatDayKey, startOfDay } from "./TimelineDate.ts";

export interface TimelineBlockSegment {
    itemId: string;
    /** Null for an Event or a Task's own due; set when this segment is one Task timebox occurrence. */
    timeboxId: string | null;
    dayKey: string;
    start: Date;
    end: Date;
    column: number;
    columnCount: number;
    /** Planned-versus-actual Focus Session totals for the item's full interval (Task 44). */
    utilization: FocusUtilizationSummary;
}

export interface TimelinePointItem {
    itemId: string;
    timeboxId: string | null;
    at: Date;
}

export interface TimelineDueItem {
    itemId: string;
    timeboxId: string | null;
    dayKey: string;
}

/**
 * One actual Focus Session (Task 62), rendered independently from any planned Timebox/Event
 * block — it's a direct child of its owning Event or Task (Task 53), not a pairing to one
 * planned interval, so it can fall outside or overlap a Timebox without inferred attribution.
 */
export interface TimelineSessionSegment {
    itemId: string;
    sessionId: string;
    dayKey: string;
    start: Date;
    end: Date;
    column: number;
    columnCount: number;
    mode: "pomodoro" | "timer" | "stopwatch";
}

export interface TimelineLayoutResult {
    blocks: TimelineBlockSegment[];
    points: TimelinePointItem[];
    dues: TimelineDueItem[];
    sessions: TimelineSessionSegment[];
}

export class TimelineLayout {
    build(items: ScheduledItem[], range: TimelineRange): TimelineLayoutResult {
        const blocks: TimelineBlockSegment[] = [];
        const points: TimelinePointItem[] = [];
        const dues: TimelineDueItem[] = [];
        const sessions: TimelineSessionSegment[] = [];

        for (const item of items) {
            const timeboxId = item.timeboxId ?? null;
            sessions.push(...this.splitSessions(item, range));
            if (item.allDay && item.start) {
                dues.push({ itemId: item.id, timeboxId, dayKey: formatDayKey(item.start) });
                continue;
            }
            if (item.start && item.end && item.end > item.start) {
                blocks.push(...this.splitBlock(item, range));
                continue;
            }
            if (item.start) points.push({ itemId: item.id, timeboxId, at: item.start });
            else if (item.remind) points.push({ itemId: item.id, timeboxId, at: item.remind });
            else if (item.due) dues.push({ itemId: item.id, timeboxId, dayKey: formatDayKey(item.due) });
        }

        this.assignColumns(blocks);
        this.assignColumns(sessions);
        return { blocks, points, dues, sessions };
    }

    private splitSessions(item: ScheduledItem, range: TimelineRange): TimelineSessionSegment[] {
        const segments: TimelineSessionSegment[] = [];
        for (const session of item.focusSessions ?? []) {
            if (!(session.end > session.start)) continue;
            let cursor = startOfDay(session.start);
            const lastDay = startOfDay(session.end);
            while (cursor <= lastDay) {
                const dayStart = startOfDay(cursor);
                const dayEnd = endOfDay(cursor);
                const start = new Date(Math.max(session.start.getTime(), dayStart.getTime(), range.start.getTime()));
                const end = new Date(Math.min(session.end.getTime(), dayEnd.getTime(), range.end.getTime()));
                if (start < end) {
                    segments.push({
                        itemId: item.id,
                        sessionId: session.sessionId,
                        dayKey: formatDayKey(dayStart),
                        start,
                        end,
                        column: 0,
                        columnCount: 1,
                        mode: session.mode,
                    });
                }
                cursor = addDays(cursor, 1);
            }
        }
        return segments;
    }

    private splitBlock(item: ScheduledItem, range: TimelineRange): TimelineBlockSegment[] {
        if (!item.start || !item.end) return [];
        const segments: TimelineBlockSegment[] = [];
        let cursor = startOfDay(item.start);
        const lastDay = startOfDay(item.end);
        const plannedSeconds = (item.end.getTime() - item.start.getTime()) / 1000;
        const utilization = summarizeFocusUtilization(plannedSeconds, item.focusSessions ?? []);

        while (cursor <= lastDay) {
            const dayStart = startOfDay(cursor);
            const dayEnd = endOfDay(cursor);
            const start = new Date(Math.max(item.start.getTime(), dayStart.getTime(), range.start.getTime()));
            const end = new Date(Math.min(item.end.getTime(), dayEnd.getTime(), range.end.getTime()));
            if (start < end) {
                segments.push({
                    itemId: item.id,
                    timeboxId: item.timeboxId ?? null,
                    dayKey: formatDayKey(dayStart),
                    start,
                    end,
                    column: 0,
                    columnCount: 1,
                    utilization,
                });
            }
            cursor = addDays(cursor, 1);
        }

        return segments;
    }

    private assignColumns<
        T extends { dayKey: string; start: Date; end: Date; column: number; columnCount: number },
    >(blocks: T[]): void {
        const byDay = new Map<string, T[]>();
        for (const block of blocks) {
            const dayBlocks = byDay.get(block.dayKey) ?? [];
            dayBlocks.push(block);
            byDay.set(block.dayKey, dayBlocks);
        }

        for (const dayBlocks of byDay.values()) {
            dayBlocks.sort((a, b) => a.start.getTime() - b.start.getTime());
            const active: T[] = [];
            for (const block of dayBlocks) {
                for (let i = active.length - 1; i >= 0; i--) {
                    if (active[i].end <= block.start) active.splice(i, 1);
                }
                const used = new Set(active.map((item) => item.column));
                let column = 0;
                while (used.has(column)) column++;
                block.column = column;
                active.push(block);
                const count = Math.max(...active.map((item) => item.column), column) + 1;
                for (const item of active) item.columnCount = Math.max(item.columnCount, count);
            }
        }
    }
}
