import type { EventTaskSettings } from "./DetailNoteSettings.ts";

/**
 * Pure resolution for `eventTask.detailNotesFolderStrategy`:
 * - "configured": the single shared `detailNotesFolder` field, regardless of kind or source.
 * - "obsidianDefault": Obsidian's own "Default location for new notes" — `resolveObsidianDefault`
 *   is only invoked for this branch, since it's the only one that needs an App.
 * - "sourceFolder" (this plugin's original, still-default behavior): the same folder as the note
 *   that owns the Task/Event's ledger line — except a Daily Note is just a place a Task is passing
 *   through before it gets filed elsewhere, so targets inside the configured Daily Notes folder
 *   fall back to `detailNotesFolder` instead.
 * - "perKind": `detailNotesFolderEvent` or `detailNotesFolderTask`, letting users who file Event
 *   and Task detail notes into separate trees do so.
 */
export function resolveDetailNotesFolder(
    settings: EventTaskSettings,
    targetFile: string,
    kind: "event" | "task",
    dailyFolder: string | null,
    resolveObsidianDefault: () => string,
): string {
    switch (settings.detailNotesFolderStrategy) {
        case "obsidianDefault":
            return resolveObsidianDefault();
        case "perKind":
            return kind === "event" ? settings.detailNotesFolderEvent : settings.detailNotesFolderTask;
        case "sourceFolder": {
            const parent = targetFile.includes("/") ? targetFile.slice(0, targetFile.lastIndexOf("/")) : "";
            if (!parent) return settings.detailNotesFolder;
            const withinDailyNotes =
                dailyFolder !== null && (parent === dailyFolder || parent.startsWith(`${dailyFolder}/`));
            return withinDailyNotes ? settings.detailNotesFolder : parent;
        }
        default:
            return settings.detailNotesFolder;
    }
}
