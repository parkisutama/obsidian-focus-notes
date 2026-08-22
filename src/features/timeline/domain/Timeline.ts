import type { ContextSourceFilter } from "../../object-notes/domain/ContextSourceFilter";

export type TimelineMode = "day" | "multi-day";

export interface TimelineSourceGroup {
    id: string;
    name: string;
    folders: string[];
    filter: ContextSourceFilter | null;
}

export interface TimelineRange {
    start: Date;
    end: Date;
}

export interface TimelineSourceState {
    visible: boolean;
    color: string;
}
