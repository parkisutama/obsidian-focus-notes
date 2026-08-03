import type { ScheduledItem, TimelineRange } from "./ScheduledItemTypes";
import { addDays, endOfDay, formatDayKey, startOfDay } from "./utils";

export class ScheduledItemQuery {
    getItemsForRange(
        items: ScheduledItem[],
        range: TimelineRange,
        opts: {
            visibleSources: Set<string>;
            includeCompleted: boolean;
        },
    ): ScheduledItem[] {
        return items.filter((item) => {
            if (!opts.visibleSources.has(item.source.groupId)) return false;
            if (item.isCompleted && !opts.includeCompleted) return false;
            if (!this.hasSchedule(item)) return false;
            return this.intersectsRange(item, range);
        });
    }

    getPendingTasks(items: ScheduledItem[], today: Date, visibleSources: Set<string>): ScheduledItem[] {
        const todayStart = startOfDay(today);
        const now = new Date();
        const timedDueCutoff = formatDayKey(today) === formatDayKey(now) ? now : todayStart;
        const earliest = addDays(todayStart, -365);
        return items.filter((item) => {
            if (item.kind !== "task" || item.isCompleted) return false;
            if (!visibleSources.has(item.source.groupId)) return false;
            const pendingAt = this.pendingAnchor(item);
            if (!pendingAt || pendingAt < earliest) return false;
            if (item.due && item.dueHasTime) return pendingAt < timedDueCutoff;
            return startOfDay(pendingAt) < todayStart;
        });
    }

    private pendingAnchor(item: ScheduledItem): Date | null {
        if (item.due) return item.due;
        if (item.end) return item.end;
        if (item.start) return item.start;
        if (item.remind) return item.remind;
        return null;
    }

    private hasSchedule(item: ScheduledItem): boolean {
        return Boolean(item.start || item.end || item.due || item.remind);
    }

    private intersectsRange(item: ScheduledItem, range: TimelineRange): boolean {
        if (item.start && item.end) return item.start < range.end && item.end > range.start;
        const dates = [item.start, item.remind, item.due].filter(Boolean) as Date[];
        return dates.some((date) => {
            const pointEnd = endOfDay(date);
            return pointEnd >= range.start && date < range.end;
        });
    }
}
