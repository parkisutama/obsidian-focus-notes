export type FocusNotesSettingsPage = "focus" | "timeline" | "capture" | "objects" | "periodical";

const CAPTURE_SECTIONS = new Set(["Moment quick capture", "Event capture", "Task capture", "Shared note creation"]);

export function settingsTabForSection(section: string): FocusNotesSettingsPage {
    if (section === "Focus Timeline") return "timeline";
    if (CAPTURE_SECTIONS.has(section)) return "capture";
    if (section === "Periodical Notes") return "periodical";
    return "focus";
}
