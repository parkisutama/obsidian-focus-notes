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
 * One actual Focus Session, always a direct child of its owning Event or Task (Task 53's grammar
 * — never a Timebox descendant). Mirrors `DisplayMode` from the focus-session feature and
 * `StressLevel`/`EmotionCategory` from the reflection feature as literal unions rather than
 * importing them, so this cross-feature domain type stays free of feature-to-feature dependencies.
 */
export interface ScheduledItemFocusSession {
    sessionId: string;
    /** The Event's or Task's own `id` — explicit here so a session survives being read independently of its owner. */
    ownerItemId: string;
    start: Date;
    end: Date;
    durationSeconds: number;
    mode: "pomodoro" | "timer" | "stopwatch";
    stressLevel: "low" | "normal" | "medium" | "high" | null;
    emotionCategory: "pleasant" | "neutral" | "unpleasant" | null;
    emotionKey: string | null;
    notes: string | null;
}

export interface ScheduledItem {
    id: string;
    /** Stable Obsidian block identity. Absent only on legacy records awaiting migration. */
    blockId?: string | null;
    /** Set when this item represents one Task timebox occurrence rather than the Task itself. */
    timeboxId?: string | null;
    /** That Timebox's own status (Task 61's owner-summary rule excludes cancelled ones from planned time). Only set alongside `timeboxId`. */
    timeboxStatus?: "planned" | "completed" | "skipped" | "cancelled" | null;
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
