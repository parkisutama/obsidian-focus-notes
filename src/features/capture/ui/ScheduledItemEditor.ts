import { type App, Notice, Platform } from "obsidian";
import type { ScheduledItem } from "../scheduled-item/domain/ScheduledItem";
import { captureEventLedgerEdit } from "../../../infrastructure/obsidian/capture/EventLedgerEditor";
import { captureTaskLedgerEdit } from "../../../infrastructure/obsidian/capture/TaskLedgerEditor";
import {
    type ResolveCanonicalScheduledItemResult,
    resolveCanonicalScheduledItemSource,
} from "../../../infrastructure/obsidian/capture/CanonicalScheduledItemResolver.ts";
import { ScheduledItemDesktopEditModal } from "../scheduled-item/ui/desktop/ScheduledItemDesktopEditModal.ts";
import { ScheduledItemMobileEditScreen } from "../scheduled-item/ui/mobile/ScheduledItemMobileEditScreen.ts";
import { TimeboxManagerModal } from "../scheduled-item/ui/desktop/TimeboxManagerModal.ts";
import { TimeboxManagerMobileScreen } from "../scheduled-item/ui/mobile/TimeboxManagerMobileScreen.ts";
import { shouldUseMobileForm } from "../scheduled-item/ui/mobile/MobileFormPolicy";
import type { LedgerRecordSnapshot } from "../scheduled-item/domain/LedgerRecordSource.ts";
import type { FocusNotesSettings } from "../../settings/domain/FocusNotesSettings";

export async function openScheduledItemEditor(
    app: App,
    item: ScheduledItem,
    getSettings: () => FocusNotesSettings,
    onComplete: () => void = () => {},
): Promise<void> {
    if (item.referenceTarget) {
        const resolved = await resolveCanonicalScheduledItemSource(app, item.referenceTarget);
        if (resolved.status !== "resolved") {
            new Notice(referenceResolutionMessage(resolved.status));
            return;
        }
        item = {
            ...item,
            source: { ...item.source, filePath: resolved.filePath, lineNumber: resolved.lineNumber },
            rawLine: resolved.rawLine,
        };
    }
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
    if (item.timeboxId) {
        openTimeboxManager(app, getSettings, captured.snapshot, item, onComplete);
        return;
    }
    if (!shouldUseMobileForm(Platform.isMobile, window.innerWidth)) {
        openDesktopEditor(app, getSettings, captured.snapshot, "task", item.title, onComplete);
        return;
    }
    openMobileEditor(app, getSettings, captured.snapshot, "task", item.title, onComplete);
}

function referenceResolutionMessage(
    status: Exclude<ResolveCanonicalScheduledItemResult["status"], "resolved">,
): string {
    if (status === "orphan") return "Canonical Task or Event not found. This reference may be stale.";
    if (status === "ambiguous") return "Multiple matching canonical blocks were found; cannot edit safely.";
    return "This reference's canonical link is invalid.";
}

/** A Timeline segment for one timebox opens the Timebox Manager pre-selecting that occurrence. */
function openTimeboxManager(
    app: App,
    getSettings: () => FocusNotesSettings,
    snapshot: LedgerRecordSnapshot,
    item: ScheduledItem,
    onComplete: () => void,
): void {
    const due = item.due ? { date: formatLocalDateTime(item.due, item.dueHasTime), hasTime: item.dueHasTime } : null;
    const options = {
        snapshot,
        title: item.title,
        completed: item.isCompleted,
        due,
        selectedTimeboxId: item.timeboxId,
    };
    try {
        if (!shouldUseMobileForm(Platform.isMobile, window.innerWidth)) {
            new TimeboxManagerModal(app, getSettings, options, onComplete).open();
        } else {
            new TimeboxManagerMobileScreen(app, getSettings, options, onComplete).open();
        }
    } catch {
        new Notice("This Scheduled Item block is ambiguous or invalid and cannot be edited safely.");
    }
}

function formatLocalDateTime(date: Date, hasTime: boolean): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    if (!hasTime) return `${y}-${m}-${d}`;
    const h = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${d} ${h}:${min}`;
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
