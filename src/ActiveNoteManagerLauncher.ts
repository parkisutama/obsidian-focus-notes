import { type App, type Component, Notice, type TFile } from "obsidian";
import { scanActiveNoteChecklistScopes, scanActiveNoteLedger } from "./ActiveNoteLedger";
import { ActiveNoteManagerModal } from "./ActiveNoteManagerModal";
import { openEventTaskForm } from "./EventTaskCaptureLauncher";
import { openScheduledItemEditor } from "./ScheduledItemEditor";
import { timelineSourceHeadings } from "./features/timeline/domain/TimelineSourceGroups";
import { ScheduledItemParser } from "./features/capture/scheduled-item/domain/ScheduledItemParser";
import type { FocusNotesSettings } from "./features/settings/domain/FocusNotesSettings";

/** Scans the active note's Scheduled Item ledger and opens the management modal for it. */
export async function openActiveNoteManager(
    app: App,
    getSettings: () => FocusNotesSettings,
    owner: Component,
    file: TFile,
): Promise<void> {
    const content = await app.vault.cachedRead(file);
    const settings = getSettings();
    const headings = timelineSourceHeadings(settings.timeline.sourceHeadings, [
        settings.captureEvent.heading,
        settings.captureTask.heading,
    ]);
    const items = scanActiveNoteLedger(file.path, file.name, content, headings, new ScheduledItemParser());
    const checklistScopes = scanActiveNoteChecklistScopes(file.path, file.name, content, new ScheduledItemParser());
    new ActiveNoteManagerModal(
        app,
        file.name,
        file.path,
        items,
        checklistScopes,
        (kind) =>
            openEventTaskForm(app, getSettings, new Date(), undefined, owner, {
                initialKind: kind,
                targetFile: file.path,
            }),
        (item) => void openScheduledItemEditor(app, item, getSettings, () => new Notice("Task or Event updated.")),
        () => void openActiveNoteManager(app, getSettings, owner, file),
    ).open();
}
