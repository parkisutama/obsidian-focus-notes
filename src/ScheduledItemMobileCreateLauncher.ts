import type { App } from "obsidian";
import { preferActiveNoteTarget } from "./CaptureTarget.ts";
import { ScheduledItemMobileCreateScreen } from "./ScheduledItemMobileCreateScreen.ts";
import { TargetResolver } from "./TargetResolver.ts";
import type { FocusNotesSettings } from "./types.ts";

export function openMobileScheduledItemCreate(
    app: App,
    getSettings: () => FocusNotesSettings,
    anchorDate: Date,
    onComplete: () => void,
    kind: "task" | "event",
    targetFile?: string,
): void {
    const settings = getSettings();
    const resolver = new TargetResolver(app, settings);
    const configured = resolver.resolve(resolver.getActiveTarget(), anchorDate);
    const activeFile = app.workspace.getActiveFile();
    const preferred = preferActiveNoteTarget(
        configured,
        targetFile ?? (activeFile?.extension === "md" ? activeFile.path : null),
    );
    new ScheduledItemMobileCreateScreen(
        app,
        getSettings,
        anchorDate,
        kind,
        {
            ...preferred,
            heading: settings.eventTask.defaultSaveHeading || preferred.heading,
        },
        onComplete,
    ).open();
}
