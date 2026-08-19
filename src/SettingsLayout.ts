export type FocusNotesSettingsPage = "focus" | "timeline" | "capture" | "objects" | "periodical";

const CAPTURE_SECTIONS = new Set([
    "Moment quick capture",
    "Event capture",
    "Task & shared note creation",
    "Task capture",
]);

export function settingsTabForSection(section: string): FocusNotesSettingsPage {
    if (section === "Focus Timeline") return "timeline";
    if (CAPTURE_SECTIONS.has(section)) return "capture";
    if (section === "Periodical Notes") return "periodical";
    return "focus";
}
