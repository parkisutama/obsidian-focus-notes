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

/**
 * One actual Focus Session attached to this occurrence (an Event, or one Task timebox). Mirrors
 * `DisplayMode` from the focus-session feature as a literal union rather than importing it, so
 * this cross-feature domain type stays free of a feature-to-feature dependency.
 */
export interface ScheduledItemFocusSession {
    sessionId: string;
    start: Date;
    end: Date;
    durationSeconds: number;
    mode: "pomodoro" | "timer" | "stopwatch";
}

export interface ScheduledItem {
    id: string;
    /** Stable Obsidian block identity. Absent only on legacy records awaiting migration. */
    blockId?: string | null;
    /** Set when this item represents one Task timebox occurrence rather than the Task itself. */
    timeboxId?: string | null;
    /**
     * Set when this record is a derived Daily reference (event-ref or task-ref), not the
     * canonical block. Value is the canonical's `file#^blockId` target; editing must resolve and
     * mutate that block, never this line.
     */
    referenceTarget?: string | null;
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
    /** Actual Focus Sessions logged against this occurrence; absent/empty when none exist yet. */
    focusSessions?: ScheduledItemFocusSession[];
    source: ScheduledItemSource;
    rawLine: string;
}
