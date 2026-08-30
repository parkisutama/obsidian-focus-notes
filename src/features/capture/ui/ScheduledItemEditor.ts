import { type App, Notice, Platform } from "obsidian";
import type { ScheduledItem } from "../scheduled-item/domain/ScheduledItem";
import { captureEventLedgerEdit } from "../../../infrastructure/obsidian/capture/EventLedgerEditor";
import { captureTaskLedgerEdit } from "../../../infrastructure/obsidian/capture/TaskLedgerEditor";
import { ScheduledItemDesktopEditModal } from "../scheduled-item/ui/desktop/ScheduledItemDesktopEditModal.ts";
import { ScheduledItemMobileEditScreen } from "../scheduled-item/ui/mobile/ScheduledItemMobileEditScreen.ts";
import { shouldUseMobileForm } from "../scheduled-item/ui/mobile/MobileFormPolicy";
import type { FocusNotesSettings } from "../../settings/domain/FocusNotesSettings";

export async function openScheduledItemEditor(
    app: App,
    item: ScheduledItem,
    getSettings: () => FocusNotesSettings,
    onComplete: () => void = () => {},
): Promise<void> {
    const source = {
        filePath: item.source.filePath,
        lineNumber: item.source.lineNumber,
        rawLine: item.rawLine,
    };
    if (item.kind === "event") {
        const captured = await captureEventLedgerEdit(app, source);
        if (captured.status !== "captured") {
            new Notice(
                captured.status === "conflict"
                    ? "Event source changed or moved. Reopen the manager and try again."
                    : "This Event contains ambiguous or invalid editable metadata.",
            );
            return;
        }
        if (!shouldUseMobileForm(Platform.isMobile, window.innerWidth)) {
            openDesktopEditor(app, getSettings, captured.snapshot, "event", item.title, onComplete);
            return;
        }
        openMobileEditor(app, getSettings, captured.snapshot, "event", item.title, onComplete);
        return;
    }

    const captured = await captureTaskLedgerEdit(app, source);
    if (captured.status !== "captured") {
        new Notice(
            captured.status === "conflict"
                ? "Task source changed or moved. Reopen the manager and try again."
                : "This Task contains ambiguous or invalid editable metadata.",
        );
        return;
    }
    if (!shouldUseMobileForm(Platform.isMobile, window.innerWidth)) {
        openDesktopEditor(app, getSettings, captured.snapshot, "task", item.title, onComplete);
        return;
    }
    openMobileEditor(app, getSettings, captured.snapshot, "task", item.title, onComplete);
}

function openMobileEditor(
    app: App,
    getSettings: () => FocusNotesSettings,
    snapshot: import("../scheduled-item/domain/LedgerRecordSource").LedgerRecordSnapshot,
    kind: "task" | "event",
    title: string,
    onComplete: () => void,
): void {
    try {
        new ScheduledItemMobileEditScreen(app, getSettings, snapshot, kind, title, onComplete).open();
    } catch {
        new Notice("This Scheduled Item block is ambiguous or invalid and cannot be edited safely.");
    }
}

function openDesktopEditor(
    app: App,
    getSettings: () => FocusNotesSettings,
    snapshot: import("../scheduled-item/domain/LedgerRecordSource").LedgerRecordSnapshot,
    kind: "task" | "event",
    title: string,
    onComplete: () => void,
): void {
    try {
        new ScheduledItemDesktopEditModal(app, getSettings, snapshot, kind, title, onComplete).open();
    } catch {
        new Notice("This Scheduled Item block is ambiguous or invalid and cannot be edited safely.");
    }
}
