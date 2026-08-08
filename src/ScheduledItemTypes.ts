export type ScheduledItemKind = "event" | "task";
export type EventOccurrenceStatus = "planned" | "completed" | "cancelled";
export type TaskPriority = "high" | "medium" | "normal" | "low";
export type TimelineMode = "day" | "multi-day";

export interface ScheduledItemSource {
    groupId: string;
    groupName: string;
    filePath: string;
    fileName: string;
    lineNumber: number;
    headingPath: string[];
}

export interface TimelineSourceGroup {
    id: string;
    name: string;
    folders: string[];
    filter: ContextSourceFilter | null;
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
    priority: TaskPriority | null;
    eventStatus: EventOccurrenceStatus | null;
    actualStart: Date | null;
    actualEnd: Date | null;
    allDay: boolean;
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

import type { ContextSourceFilter } from "./types";
