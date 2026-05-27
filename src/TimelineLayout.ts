import { ScheduledItem, TimelineRange } from "./ScheduledItemTypes";
import { addDays, endOfDay, formatDayKey, startOfDay } from "./utils";

export interface TimelineBlockSegment {
    itemId: string;
    dayKey: string;
    start: Date;
    end: Date;
    column: number;
    columnCount: number;
}

export interface TimelinePointItem {
    itemId: string;
    at: Date;
}

export interface TimelineDueItem {
    itemId: string;
    dayKey: string;
}

export interface TimelineLayoutResult {
    blocks: TimelineBlockSegment[];
    points: TimelinePointItem[];
    dues: TimelineDueItem[];
}

export class TimelineLayout {
    build(items: ScheduledItem[], range: TimelineRange): TimelineLayoutResult {
        const blocks: TimelineBlockSegment[] = [];
        const points: TimelinePointItem[] = [];
        const dues: TimelineDueItem[] = [];

        for (const item of items) {
            if (item.start && item.end && item.end > item.start) {
                blocks.push(...this.splitBlock(item, range));
                continue;
            }
            if (item.start) points.push({ itemId: item.id, at: item.start });
            else if (item.remind) points.push({ itemId: item.id, at: item.remind });
            else if (item.due) dues.push({ itemId: item.id, dayKey: formatDayKey(item.due) });
        }

        this.assignColumns(blocks);
        return { blocks, points, dues };
    }

    private splitBlock(item: ScheduledItem, range: TimelineRange): TimelineBlockSegment[] {
        if (!item.start || !item.end) return [];
        const segments: TimelineBlockSegment[] = [];
        let cursor = startOfDay(item.start);
        const lastDay = startOfDay(item.end);

        while (cursor <= lastDay) {
            const dayStart = startOfDay(cursor);
            const dayEnd = endOfDay(cursor);
            const start = new Date(Math.max(item.start.getTime(), dayStart.getTime(), range.start.getTime()));
            const end = new Date(Math.min(item.end.getTime(), dayEnd.getTime(), range.end.getTime()));
            if (start < end) {
                segments.push({
                    itemId: item.id,
                    dayKey: formatDayKey(dayStart),
                    start,
                    end,
                    column: 0,
                    columnCount: 1
                });
            }
            cursor = addDays(cursor, 1);
        }

        return segments;
    }

    private assignColumns(blocks: TimelineBlockSegment[]): void {
        const byDay = new Map<string, TimelineBlockSegment[]>();
        for (const block of blocks) {
            const dayBlocks = byDay.get(block.dayKey) ?? [];
            dayBlocks.push(block);
            byDay.set(block.dayKey, dayBlocks);
        }

        for (const dayBlocks of byDay.values()) {
            dayBlocks.sort((a, b) => a.start.getTime() - b.start.getTime());
            const active: TimelineBlockSegment[] = [];
            for (const block of dayBlocks) {
                for (let i = active.length - 1; i >= 0; i--) {
                    if (active[i].end <= block.start) active.splice(i, 1);
                }
                const used = new Set(active.map(item => item.column));
                let column = 0;
                while (used.has(column)) column++;
                block.column = column;
                active.push(block);
                const count = Math.max(...active.map(item => item.column), column) + 1;
                for (const item of active) item.columnCount = Math.max(item.columnCount, count);
            }
        }
    }
}

