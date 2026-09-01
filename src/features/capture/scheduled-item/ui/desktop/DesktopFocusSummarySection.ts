import type { FormattedFocusSummary } from "../../domain/ScheduledItemFocusSummary.ts";

/**
 * Task 64: the same shared Task 61/63 summary Timeline's item modal shows, presented compactly
 * above Manage's Focus Sessions list. Purely a presentation of an already-computed value — never
 * written into canonical Markdown, and updates only because the caller recomputes it fresh on
 * every render (see ScheduledItemDesktopEditModal.computeFocusSummary).
 */
export function renderDesktopFocusSummarySection(container: HTMLElement, summary: FormattedFocusSummary): void {
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
