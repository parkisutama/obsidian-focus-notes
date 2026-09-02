import {
    type CalendarCell,
    type DateTimeParts,
    buildCalendarWeeks,
    formatCanonicalValue,
    formatDisplayValue,
    isSameDay,
    parseCanonicalValue,
    partsFromJsDate,
} from "../../domain/DateTimeFormat.ts";

const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTH_LABELS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

export interface MobileDateTimePickerOptions {
    initialValue: string | null;
    requireTime: boolean;
    ariaLabel: string;
    onChange(value: string | null): void;
}

/**
 * Mobile counterpart to DesktopDateTimePicker — same locale-free DD/MM/YYYY + 24-hour rendering
 * (DateTimeFormat), but the calendar expands inline below the trigger instead of a floating
 * popup, matching this app's mobile forms (which already avoid floating widgets fighting the
 * on-screen-keyboard/viewport-metrics handling — see MobileViewport.ts) rather than a new one.
 */
export class MobileDateTimePicker {
    private parts: DateTimeParts | null;
    private viewYear: number;
    private viewMonth: number;
    private triggerEl!: HTMLButtonElement;
    private panelEl: HTMLElement | null = null;

    constructor(private readonly options: MobileDateTimePickerOptions) {
        this.parts = parseCanonicalValue(options.initialValue);
        const base = this.parts ?? partsFromJsDate(new Date(), null, null);
        this.viewYear = base.year;
        this.viewMonth = base.month;
    }

    render(container: HTMLElement): HTMLElement {
        const wrap = container.createDiv({ cls: "fn-mobile-datetime" });
        this.triggerEl = wrap.createEl("button", {
            type: "button",
            cls: "fn-mobile-datetime-trigger",
            attr: { "aria-label": this.options.ariaLabel },
        });
        this.updateTriggerText();
        this.triggerEl.addEventListener("click", () => this.togglePanel(wrap));
        return wrap;
    }

    destroy(): void {
        this.panelEl = null;
    }

    private togglePanel(wrap: HTMLElement): void {
        if (this.panelEl) {
            this.panelEl.remove();
            this.panelEl = null;
            return;
        }
        this.panelEl = wrap.createDiv({ cls: "fn-mobile-datetime-panel" });
        this.renderPanelContent(this.panelEl);
    }

    private updateTriggerText(): void {
        this.triggerEl.setText(formatDisplayValue(this.parts) || "Set date…");
        this.triggerEl.toggleClass("fn-mobile-datetime-trigger--empty", this.parts === null);
    }

    private renderPanelContent(panel: HTMLElement): void {
        panel.empty();
        this.renderMonthHeader(panel);
        this.renderWeekdayRow(panel);
        this.renderDayGrid(panel);
        if (this.options.requireTime) this.renderTimeRow(panel);
        this.renderFooter(panel);
    }

    private renderMonthHeader(panel: HTMLElement): void {
        const header = panel.createDiv({ cls: "fn-mobile-datetime-header" });
        const prev = header.createEl("button", {
            type: "button",
            cls: "fn-mobile-datetime-nav",
            attr: { "aria-label": "Previous month" },
        });
        prev.setText("‹");
        prev.addEventListener("click", () => this.shiftMonth(-1));
        header.createSpan({
            cls: "fn-mobile-datetime-title",
            text: `${MONTH_LABELS[this.viewMonth - 1]} ${this.viewYear}`,
        });
        const next = header.createEl("button", {
            type: "button",
            cls: "fn-mobile-datetime-nav",
            attr: { "aria-label": "Next month" },
        });
        next.setText("›");
        next.addEventListener("click", () => this.shiftMonth(1));
    }

    private shiftMonth(delta: number): void {
        const total = this.viewYear * 12 + (this.viewMonth - 1) + delta;
        this.viewYear = Math.floor(total / 12);
        this.viewMonth = (((total % 12) + 12) % 12) + 1;
        if (this.panelEl) this.renderPanelContent(this.panelEl);
    }

    private renderWeekdayRow(panel: HTMLElement): void {
        const row = panel.createDiv({ cls: "fn-mobile-datetime-weekdays" });
        for (const label of WEEKDAY_LABELS) row.createSpan({ text: label });
    }

    private renderDayGrid(panel: HTMLElement): void {
        const grid = panel.createDiv({ cls: "fn-mobile-datetime-grid" });
        const weeks = buildCalendarWeeks(this.viewYear, this.viewMonth);
        const today = partsFromJsDate(new Date(), null, null);
        for (const week of weeks) {
            for (const cell of week) this.renderDayCell(grid, cell, today);
        }
    }

    private renderDayCell(grid: HTMLElement, cell: CalendarCell, today: DateTimeParts): void {
        const cellParts: DateTimeParts = { year: cell.year, month: cell.month, day: cell.day, hour: null, minute: null };
        const button = grid.createEl("button", {
            type: "button",
            cls: "fn-mobile-datetime-day",
            text: String(cell.day),
        });
        button.toggleClass("fn-mobile-datetime-day--outside", !cell.inCurrentMonth);
        button.toggleClass("fn-mobile-datetime-day--today", isSameDay(cellParts, today));
        button.toggleClass(
            "fn-mobile-datetime-day--selected",
            this.parts !== null && isSameDay(cellParts, this.parts),
        );
        button.addEventListener("click", () => this.selectDay(cell));
    }

    private selectDay(cell: CalendarCell): void {
        const hour = this.parts?.hour ?? (this.options.requireTime ? 0 : null);
        const minute = this.parts?.minute ?? (this.options.requireTime ? 0 : null);
        this.parts = { year: cell.year, month: cell.month, day: cell.day, hour, minute };
        this.emit();
        this.updateTriggerText();
        if (this.panelEl) this.renderPanelContent(this.panelEl);
    }

    private renderTimeRow(panel: HTMLElement): void {
        const row = panel.createDiv({ cls: "fn-mobile-datetime-time" });
        const hourInput = row.createEl("input", {
            type: "number",
            cls: "fn-mobile-datetime-time-input",
            attr: { min: "0", max: "23", "aria-label": "Hour (24-hour)" },
        });
        hourInput.value = this.parts?.hour !== null && this.parts?.hour !== undefined ? String(this.parts.hour) : "0";
        row.createSpan({ text: ":", cls: "fn-mobile-datetime-time-sep" });
        const minuteInput = row.createEl("input", {
            type: "number",
            cls: "fn-mobile-datetime-time-input",
            attr: { min: "0", max: "59", "aria-label": "Minute" },
        });
        minuteInput.value =
            this.parts?.minute !== null && this.parts?.minute !== undefined ? String(this.parts.minute) : "0";
        const commit = (): void => {
            const hour = clamp(parseInt(hourInput.value, 10), 0, 23);
            const minute = clamp(parseInt(minuteInput.value, 10), 0, 59);
            const base = this.parts ?? partsFromJsDate(new Date(), hour, minute);
            this.parts = { ...base, hour, minute };
            this.emit();
            this.updateTriggerText();
        };
        hourInput.addEventListener("change", commit);
        minuteInput.addEventListener("change", commit);
    }

    private renderFooter(panel: HTMLElement): void {
        const footer = panel.createDiv({ cls: "fn-mobile-datetime-footer" });
        const todayBtn = footer.createEl("button", { type: "button", text: "Today" });
        todayBtn.addEventListener("click", () => {
            const now = new Date();
            this.selectDay({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate(), inCurrentMonth: true });
            if (this.options.requireTime) {
                this.parts = { ...this.parts!, hour: now.getHours(), minute: now.getMinutes() };
                this.emit();
                this.updateTriggerText();
                if (this.panelEl) this.renderPanelContent(this.panelEl);
            }
        });
        const clearBtn = footer.createEl("button", { type: "button", text: "Clear" });
        clearBtn.addEventListener("click", () => {
            this.parts = null;
            this.emit();
            this.updateTriggerText();
            this.panelEl?.remove();
            this.panelEl = null;
        });
        const doneBtn = footer.createEl("button", { type: "button", cls: "mod-cta", text: "Done" });
        doneBtn.addEventListener("click", () => {
            this.panelEl?.remove();
            this.panelEl = null;
        });
    }

    private emit(): void {
        this.options.onChange(this.parts ? formatCanonicalValue(this.parts) : null);
    }
}

function clamp(value: number, min: number, max: number): number {
    if (Number.isNaN(value)) return min;
    return Math.min(max, Math.max(min, value));
}
