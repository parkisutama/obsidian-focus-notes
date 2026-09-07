import type { ScannedFocusSession } from "../../../focus-session/domain/FocusSessionBlockScan.ts";
import type { FormattedFocusSummary } from "../domain/ScheduledItemFocusSummary.ts";

export interface FocusDisclosureOptions {
    summary?: FormattedFocusSummary | null;
    sessions?: ScannedFocusSession[];
    renderBody(container: HTMLElement): void;
}

export function renderFocusDisclosure(container: HTMLElement, options: FocusDisclosureOptions): void {
    if (!options.summary && !options.sessions?.length) return;
    const disclosure = container.createEl("details", { cls: "fn-focus-disclosure" });
    const summary = disclosure.createEl("summary", { cls: "fn-focus-disclosure-summary" });
    summary.createSpan({ text: "Focus session", cls: "focus-notes-modal-label" });
    summary.createSpan({
        cls: "fn-focus-disclosure-value",
        text: options.summary
            ? `${options.summary.focusedLabel} / ${options.summary.plannedLabel} · ${options.summary.sessionCountLabel}`
            : `${options.sessions?.length ?? 0} sessions`,
    });
    options.renderBody(disclosure.createDiv({ cls: "fn-focus-disclosure-body" }));
}
