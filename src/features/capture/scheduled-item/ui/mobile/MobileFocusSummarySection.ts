import type { FormattedFocusSummary } from "../../domain/ScheduledItemFocusSummary.ts";

/** Mobile counterpart to DesktopFocusSummarySection.ts — same shared, pre-computed summary. */
export function renderMobileFocusSummarySection(container: HTMLElement, summary: FormattedFocusSummary): void {
    const section = container.createDiv({ cls: "fn-focus-summary" });
    section.createSpan({
        cls: "fn-focus-summary-headline",
        text: `${summary.focusedLabel} of ${summary.plannedLabel} planned (${summary.percentageLabel})`,
    });
    section.createSpan({
        cls: "fn-focus-summary-detail",
        text: `${summary.differenceLabel} · ${summary.sessionCountLabel}`,
    });
}
