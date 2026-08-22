export type ScheduledItemKind = "event" | "task";
export type EventOccurrenceStatus = "planned" | "completed" | "cancelled";
export type TaskPriority = "high" | "medium" | "normal" | "low";

export interface ScheduledItemSource {
    groupId: string;
    groupName: string;
    filePath: string;
    fileName: string;
    lineNumber: number;
    headingPath: string[];
}

export interface ScheduledItem {
    id: string;
    /** Stable Obsidian block identity. Absent only on legacy records awaiting migration. */
    blockId?: string | null;
    kind: ScheduledItemKind;
    title: string;
    start: Date | null;
    end: Date | null;
    due: Date | null;
    dueHasTime: boolean;
    remind: Date | null;
    priority: TaskPriority | null;
    eventStatus: EventOccurrenceStatus | null;
    actualStart: Date | null;
    actualEnd: Date | null;
    allDay: boolean;
    isCompleted: boolean;
    source: ScheduledItemSource;
    rawLine: string;
}
