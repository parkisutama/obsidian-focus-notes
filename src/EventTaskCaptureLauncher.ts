import { type App, type Component, Platform } from "obsidian";
import { preferActiveNoteTarget } from "./features/capture/domain/ActiveCaptureTarget";
import { EventTaskModal } from "./EventTaskModal";
import { EventTaskMobileScreen } from "./EventTaskMobileScreen";
import type { OpenEventTaskFormOptions } from "./features/capture/domain/CaptureForm";
import { shouldUseMobileForm } from "./MobileFormPolicy";
import { ScheduledItemDesktopCreateModal } from "./ScheduledItemDesktopCreateModal.ts";
import { openMobileScheduledItemCreate } from "./ScheduledItemMobileCreateLauncher.ts";
import { TargetResolver } from "./infrastructure/obsidian/capture/TargetResolver";
import type { FocusNotesSettings } from "./features/settings/domain/FocusNotesSettings";
import type { FocusTarget } from "./features/capture/domain/CaptureTarget";

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
    const resolver = new TargetResolver(app, settings);
    // Task never defaults to Daily Notes / the ambient active target — it should
    // attach to a specific Project or task-list note, chosen explicitly. An
    // active markdown note is still preferred below as a convenience default
    // (typically the project/list note the user is already working in); with
    // nothing active, the target stays empty and submit() blocks until the
    // user picks one, avoiding accidental duplication into Daily Notes.
    const configured: FocusTarget =
        kind === "task"
            ? { file: "", heading: settings.captureTask.heading, position: settings.captureTask.position }
            : (resolver.getPeriodicalTarget(settings.captureEvent.profileId, anchorDate) ?? {
                  file: "",
                  heading: settings.captureEvent.heading,
                  position: settings.captureEvent.position,
              });
    const activeFile = app.workspace.getActiveFile();
    const preferred = preferActiveNoteTarget(
        configured,
        targetFile ?? (activeFile?.extension === "md" ? activeFile.path : null),
    );
    new ScheduledItemDesktopCreateModal(
        app,
        getSettings,
        anchorDate,
        kind,
        {
            ...preferred,
            heading:
                kind === "task"
                    ? settings.captureTask.heading || preferred.heading
                    : settings.captureEvent.heading || preferred.heading,
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
