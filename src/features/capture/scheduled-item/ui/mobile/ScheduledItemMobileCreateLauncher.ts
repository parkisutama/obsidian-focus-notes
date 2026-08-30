import type { App } from "obsidian";
import { preferActiveNoteTarget } from "../../../domain/ActiveCaptureTarget.ts";
import { EventTaskMobileScreen } from "../../../moment/ui/mobile/EventTaskMobileScreen.ts";
import { ScheduledItemMobileCreateScreen } from "./ScheduledItemMobileCreateScreen.ts";
import { TargetResolver } from "../../../../../infrastructure/obsidian/capture/TargetResolver.ts";
import type { FocusNotesSettings } from "../../../../settings/domain/FocusNotesSettings.ts";
import type { FocusTarget } from "../../../domain/CaptureTarget";
import { resolveEventCaptureTarget } from "../../application/ScheduledItemCaptureTarget.ts";

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
    // Task never defaults to Daily Notes / the ambient active target — see the
    // matching comment in EventTaskCaptureLauncher.ts's openDesktopScheduledItemCreate().
    const activeFile = app.workspace.getActiveFile();
    const preferred: FocusTarget =
        kind === "task"
            ? preferActiveNoteTarget(
                  { file: "", heading: settings.captureTask.heading, position: settings.captureTask.position },
                  targetFile ?? (activeFile?.extension === "md" ? activeFile.path : null),
              )
            : resolveEventCaptureTarget(
                  resolver.getPeriodicalTarget(settings.captureEvent.profileId, anchorDate),
                  settings.captureEvent,
                  targetFile,
              );
    new ScheduledItemMobileCreateScreen(
        app,
        getSettings,
        anchorDate,
        kind,
        {
            ...preferred,
            heading: kind === "task" ? settings.captureTask.heading || preferred.heading : preferred.heading,
        },
        onComplete,
        (nextKind) => {
            if (nextKind === "inbox") {
                new EventTaskMobileScreen(app, getSettings, anchorDate, onComplete, { initialKind: "inbox" }, (kind) =>
                    openMobileScheduledItemCreate(app, getSettings, anchorDate, onComplete, kind),
                ).open();
                return;
            }
            openMobileScheduledItemCreate(app, getSettings, anchorDate, onComplete, nextKind);
        },
    ).open();
}
