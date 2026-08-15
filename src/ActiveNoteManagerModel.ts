import type { ScheduledItem } from "./ScheduledItemTypes";

export interface ActiveNoteManagerGroup {
    heading: string;
    items: ScheduledItem[];
}

export interface ActiveNoteManagerModel {
    title: string;
    subtitle: string;
    emptyMessage: string;
    groups: ActiveNoteManagerGroup[];
}

export function buildActiveNoteManagerModel(fileName: string, items: ScheduledItem[]): ActiveNoteManagerModel {
    const groups = new Map<string, ScheduledItem[]>();
    for (const item of items) {
        const heading = item.source.headingPath.at(-1) ?? "Ledger";
        const entries = groups.get(heading) ?? [];
        entries.push(item);
        groups.set(heading, entries);
    }

    return {
        title: "Tasks & events",
        subtitle: fileName,
        emptyMessage: "No Task or Event records found under the configured ledger headings.",
        groups: Array.from(groups, ([heading, entries]) => ({ heading, items: entries })),
    };
}

export function activeNoteItemMeta(item: ScheduledItem): string {
    const kind = item.kind === "event" ? "Event" : "Task";
    const state = item.kind === "event" ? (item.eventStatus ?? "planned") : item.isCompleted ? "completed" : "open";
    return `${kind} · ${state} · line ${item.source.lineNumber}`;
}
