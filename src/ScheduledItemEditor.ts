import { type App, Notice } from "obsidian";
import { openEventEditForm } from "./EventEditModal";
import { captureEventLedgerEdit } from "./EventLedgerEditor";
import type { ScheduledItem } from "./ScheduledItemTypes";
import { openTaskEditForm } from "./TaskEditModal";
import { captureTaskLedgerEdit } from "./TaskLedgerEditor";

export async function openScheduledItemEditor(
    app: App,
    item: ScheduledItem,
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
        openEventEditForm(app, item.title, captured.snapshot, captured.edit, onComplete);
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
    openTaskEditForm(app, item.title, captured.snapshot, captured.edit, onComplete);
}
