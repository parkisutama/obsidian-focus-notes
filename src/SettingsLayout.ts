export type FocusNotesSettingsViewId =
    | "root"
    | "periodical"
    | "objects"
    | "objects-source"
    | "focus"
    | "capture"
    | "capture-moment"
    | "capture-event"
    | "capture-task"
    | "capture-shared"
    | "timeline";

/** Every view id except "objects-source", which always needs an explicit sourceId alongside it. */
export type NavigableViewId = Exclude<FocusNotesSettingsViewId, "objects-source">;

export interface SettingsCategory {
    id: NavigableViewId;
    label: string;
    description: string;
}

/** Root-level category rows, in display order. */
export const ROOT_CATEGORIES: SettingsCategory[] = [
    {
        id: "periodical",
        label: "Periodical Notes",
        description: "Daily, Weekly, or custom-named periodical notes other settings can target.",
    },
    {
        id: "objects",
        label: "Objects",
        description: "People, Places, and other note types the @ suggester and Task destinations can reference.",
    },
    {
        id: "focus",
        label: "Focus",
        description: "Timer durations, session logging target, date grouping, entry templates, and sidebar behavior.",
    },
    {
        id: "capture",
        label: "Capture",
        description: "Where new Moments, Events, and Tasks are saved by default, and shared detail-note settings.",
    },
    {
        id: "timeline",
        label: "Timeline",
        description: "Enable the Focus Timeline planner and configure its default view, sources, and display options.",
    },
];

/** Capture sub-category rows, in display order. */
export const CAPTURE_CATEGORIES: SettingsCategory[] = [
    {
        id: "capture-moment",
        label: "Moment capture",
        description: "Default target, heading, position, and same-day backlink for new Moments.",
    },
    {
        id: "capture-event",
        label: "Event capture",
        description: "Default target, heading, position, and hub notes folder for new Events.",
    },
    {
        id: "capture-task",
        label: "Task capture",
        description: "Allowed Object Sources, heading, position, and hub notes folder for new Tasks.",
    },
    {
        id: "capture-shared",
        label: "Shared note creation",
        description: "Detail notes folder, templates, and frontmatter fields shared by Event and Task.",
    },
];

const PARENT: Partial<Record<FocusNotesSettingsViewId, NavigableViewId>> = {
    periodical: "root",
    objects: "root",
    focus: "root",
    capture: "root",
    timeline: "root",
    "capture-moment": "capture",
    "capture-event": "capture",
    "capture-task": "capture",
    "capture-shared": "capture",
    "objects-source": "objects",
};

/** The view a Back button should return to, or null if `id` is already the root. */
export function parentView(id: FocusNotesSettingsViewId): NavigableViewId | null {
    return PARENT[id] ?? null;
}
