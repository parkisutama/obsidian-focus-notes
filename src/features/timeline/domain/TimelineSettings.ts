import type { TimelineMode } from "./Timeline";

export interface FocusTimelineSettings {
    enabled: boolean;
    defaultMode: TimelineMode;
    multiDaySpanDays: number;
    weekStartsOn: number;
    sourceFolders: string[];
    sourceHeadings: string[];
    showCompletedTasks: boolean;
    showPendingSummary: boolean;
    sourceSidebarCollapsed: boolean;
    sourceVisibility: Record<string, boolean>;
    sourceColors: Record<string, string>;
}
