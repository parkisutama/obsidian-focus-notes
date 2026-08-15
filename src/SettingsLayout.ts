export type FocusNotesSettingsPage = "focus" | "timeline" | "capture" | "objects";

export function settingsTabForSection(section: string): FocusNotesSettingsPage {
    if (section === "Focus Timeline") return "timeline";
    if (section === "Inbox quick capture" || section === "Event & Task Creation") return "capture";
    return "focus";
}
