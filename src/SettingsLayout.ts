export type FocusNotesSettingsPage = "focus" | "timeline" | "capture" | "objects" | "periodical";

export function settingsTabForSection(section: string): FocusNotesSettingsPage {
    if (section === "Focus Timeline") return "timeline";
    if (section === "Moment quick capture" || section === "Event & Task Creation") return "capture";
    if (section === "Periodical Notes") return "periodical";
    return "focus";
}
