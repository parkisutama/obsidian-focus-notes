import { type App, type Component, Platform } from "obsidian";
import { preferActiveNoteTarget } from "../domain/ActiveCaptureTarget";
import { EventTaskModal } from "../moment/ui/desktop/EventTaskModal";
import { EventTaskMobileScreen } from "../moment/ui/mobile/EventTaskMobileScreen";
import type { OpenEventTaskFormOptions } from "../domain/CaptureForm";
import { shouldUseMobileForm } from "../scheduled-item/ui/mobile/MobileFormPolicy";
import { ScheduledItemDesktopCreateModal } from "../scheduled-item/ui/desktop/ScheduledItemDesktopCreateModal.ts";
import { resolveEventCaptureTarget } from "../scheduled-item/application/ScheduledItemCaptureTarget.ts";
import { openMobileScheduledItemCreate } from "../scheduled-item/ui/mobile/ScheduledItemMobileCreateLauncher.ts";
import { TargetResolver } from "../../../infrastructure/obsidian/capture/TargetResolver";
import type { FocusNotesSettings } from "../../settings/domain/FocusNotesSettings";
import type { FocusTarget } from "../domain/CaptureTarget";

export function openEventTaskForm(
    app: App,
    getSettings: () => FocusNotesSettings,
    anchorDate: Date = new Date(),
    onComplete: () => void = () => {},
    owner?: Component,
    options: OpenEventTaskFormOptions = {},
): void {
    if (shouldUseMobileForm(Platform.isMobile, window.innerWidth)) {
        if (options.initialKind === "task" || options.initialKind === "event") {
            openMobileScheduledItemCreate(
                app,
                getSettings,
                anchorDate,
                onComplete,
                options.initialKind,
                options.targetFile,
            );
            return;
        }
        new EventTaskMobileScreen(app, getSettings, anchorDate, onComplete, options, (kind) =>
            openMobileScheduledItemCreate(app, getSettings, anchorDate, onComplete, kind),
        ).open(owner);
        return;
    }

    if (options.initialKind === "task" || options.initialKind === "event") {
        openDesktopScheduledItemCreate(
            app,
            getSettings,
            anchorDate,
            onComplete,
            options.initialKind,
            options.targetFile,
        );
        return;
    }

    new EventTaskModal(app, getSettings, anchorDate, onComplete, options, (kind) =>
        openDesktopScheduledItemCreate(app, getSettings, anchorDate, onComplete, kind),
    ).open();
}

export function openDesktopScheduledItemCreate(
    app: App,
    getSettings: () => FocusNotesSettings,
    anchorDate: Date,
    onComplete: () => void,
    kind: "task" | "event",
    targetFile?: string,
): void {
    const settings = getSettings();
    const resolver = new TargetResolver(settings);
    // Task never defaults to Daily Notes / the ambient active target — it should
    // attach to a specific Project or task-list note, chosen explicitly. An
    // active markdown note is still preferred below as a convenience default
    // (typically the project/list note the user is already working in); with
    // nothing active, the target stays empty and submit() blocks until the
    // user picks one, avoiding accidental duplication into Daily Notes.
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
    new ScheduledItemDesktopCreateModal(
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
                new EventTaskModal(app, getSettings, anchorDate, onComplete, { initialKind: "inbox" }, (kind) =>
                    openDesktopScheduledItemCreate(app, getSettings, anchorDate, onComplete, kind),
                ).open();
                return;
            }
            openDesktopScheduledItemCreate(app, getSettings, anchorDate, onComplete, nextKind);
        },
    ).open();
}
