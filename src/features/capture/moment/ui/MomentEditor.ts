import { type App, Notice } from "obsidian";
import { captureMomentEdit } from "../../../../infrastructure/obsidian/capture/MomentLedgerEditor.ts";
import type { LedgerRecordSource } from "../../scheduled-item/domain/LedgerRecordSource.ts";
import { MomentDesktopEditModal } from "./desktop/MomentDesktopEditModal.ts";
import type { FocusNotesSettings } from "../../../settings/domain/FocusNotesSettings";

/**
 * Desktop-only for now: mobile's equivalent screen lands with the mobile Moment
 * Reflection task and will branch this the same way ScheduledItemEditor does.
 */
export async function openMomentEditor(
    app: App,
    source: LedgerRecordSource,
    getSettings: () => FocusNotesSettings,
    onComplete: () => void = () => {},
): Promise<void> {
    const captured = await captureMomentEdit(app, source);
    if (captured.status !== "captured") {
        new Notice(momentCaptureFailureMessage(captured.status));
        return;
    }
    new MomentDesktopEditModal({
        app,
        snapshot: captured.snapshot,
        block: captured.block,
        getContextSources: () => getSettings().inbox.contextSources,
        onComplete,
    }).open();
}

function momentCaptureFailureMessage(status: "conflict" | "invalid"): string {
    if (status === "invalid") return "This Moment block is ambiguous or invalid and cannot be edited safely.";
    return "Moment source changed or moved. Reopen and try again.";
}
