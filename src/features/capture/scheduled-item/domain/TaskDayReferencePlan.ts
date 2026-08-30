import { localDayKey, touchedLocalDays } from "./EventDayReference.ts";

export interface TaskDayReferencePlanEntry {
    date: string;
    due: boolean;
    timeboxId: string | null;
}

export interface TaskDayReferenceTimebox {
    timeboxId: string;
    start: Date;
    end: Date | null;
}

/**
 * Plans one reference entry per (day, timebox) touched, merging the due-date role into the
 * first timebox reference that lands on the same day so due and timebox never produce two
 * competing entries for one day (the spec's semantic-role dedup rule). A Task with neither a
 * due date nor any timebox plans no entries at all.
 */
export function planTaskDayReferences(
    dueDayKey: string | null,
    timeboxes: readonly TaskDayReferenceTimebox[],
): TaskDayReferencePlanEntry[] {
    const entries: TaskDayReferencePlanEntry[] = [];
    let dueMerged = false;
    for (const timebox of timeboxes) {
        for (const day of touchedLocalDays(timebox.start, timebox.end).map(localDayKey)) {
            const mergeDue = !dueMerged && day === dueDayKey;
            if (mergeDue) dueMerged = true;
            entries.push({ date: day, due: mergeDue, timeboxId: timebox.timeboxId });
        }
    }
    if (dueDayKey && !dueMerged) entries.push({ date: dueDayKey, due: true, timeboxId: null });
    return entries;
}

export interface TaskDayReferenceDiff {
    readonly toCreate: readonly TaskDayReferencePlanEntry[];
    readonly toRemove: readonly TaskDayReferencePlanEntry[];
}

/**
 * Diffs a previous and next reference plan by (day, timebox) identity so unchanged entries are
 * never rewritten; an entry whose due role flips (merged in or out) is replaced rather than
 * edited in place, since references only support create/remove primitives.
 */
export function diffTaskDayReferences(
    previous: readonly TaskDayReferencePlanEntry[],
    next: readonly TaskDayReferencePlanEntry[],
): TaskDayReferenceDiff {
    const previousByKey = new Map(previous.map((entry) => [entryKey(entry), entry]));
    const nextByKey = new Map(next.map((entry) => [entryKey(entry), entry]));
    const toCreate: TaskDayReferencePlanEntry[] = [];
    const toRemove: TaskDayReferencePlanEntry[] = [];

    for (const [key, entry] of nextByKey) {
        const previousEntry = previousByKey.get(key);
        if (!previousEntry) {
            toCreate.push(entry);
        } else if (previousEntry.due !== entry.due) {
            toRemove.push(previousEntry);
            toCreate.push(entry);
        }
    }
    for (const [key, entry] of previousByKey) {
        if (!nextByKey.has(key)) toRemove.push(entry);
    }
    return { toCreate, toRemove };
}

function entryKey(entry: TaskDayReferencePlanEntry): string {
    return `${entry.date}::${entry.timeboxId ?? ""}`;
}
