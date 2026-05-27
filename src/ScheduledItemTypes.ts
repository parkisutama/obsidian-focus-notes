export type ScheduledItemKind = "event" | "task";
export type TimelineMode = "day" | "multi-day";

export interface ScheduledItemSource {
    filePath: string;
    fileName: string;
    lineNumber: number;
    headingPath: string[];
}

export interface ScheduledItem {
    id: string;
    kind: ScheduledItemKind;
    title: string;
    start: Date | null;
    end: Date | null;
    due: Date | null;
    dueHasTime: boolean;
    remind: Date | null;
    isCompleted: boolean;
    source: ScheduledItemSource;
    rawLine: string;
}

export interface TimelineRange {
    start: Date;
    end: Date;
}

export interface TimelineSourceState {
    visible: boolean;
    color: string;
}
