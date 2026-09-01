import { type App, Notice, Platform } from "obsidian";
import { captureMomentEdit } from "../../../../infrastructure/obsidian/capture/MomentLedgerEditor.ts";
import type { LedgerRecordSource } from "../../scheduled-item/domain/LedgerRecordSource.ts";
import { MomentDesktopEditModal } from "./desktop/MomentDesktopEditModal.ts";
import { MomentMobileEditScreen } from "./mobile/MomentMobileEditScreen.ts";
import { shouldUseMobileForm } from "../../scheduled-item/ui/mobile/MobileFormPolicy.ts";
import type { FocusNotesSettings } from "../../../settings/domain/FocusNotesSettings";

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
    const options = {
        app,
        snapshot: captured.snapshot,
        block: captured.block,
        getContextSources: () => getSettings().inbox.contextSources,
        onComplete,
    };
    if (!shouldUseMobileForm(Platform.isMobile, window.innerWidth)) {
        new MomentDesktopEditModal(options).open();
        return;
    }
    new MomentMobileEditScreen(options).open();
}

function momentCaptureFailureMessage(status: "conflict" | "invalid"): string {
    if (status === "invalid") return "This Moment block is ambiguous or invalid and cannot be edited safely.";
    return "Moment source changed or moved. Reopen and try again.";
}
