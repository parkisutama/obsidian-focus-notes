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

export interface DesktopDateTimePickerOptions {
    initialValue: string | null;
    requireTime: boolean;
    ariaLabel: string;
    onChange(value: string | null): void;
}

/**
 * Replaces native <input type="date"/"time"/"datetime-local"> with a button that opens a
 * self-built calendar popup — the display format (DD/MM/YYYY, 24-hour) is then entirely ours to
 * control rather than following the OS/Electron process locale. Time is two plain number inputs
 * (0-23 / 0-59), not a native time control, since digits alone can't have an AM/PM ambiguity.
 */
export class DesktopDateTimePicker {
    private parts: DateTimeParts | null;
    private viewYear: number;
    private viewMonth: number;
    private wrapEl!: HTMLElement;
    private buttonEl!: HTMLButtonElement;
    private popupEl: HTMLElement | null = null;
    private readonly onOutsideClick = (event: MouseEvent): void => {
        if (this.popupEl && !this.wrapEl.contains(event.target as Node)) this.closePopup();
    };
    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (event.key === "Escape") this.closePopup();
    };

    constructor(private readonly options: DesktopDateTimePickerOptions) {
        this.parts = parseCanonicalValue(options.initialValue);
        const base = this.parts ?? partsFromJsDate(new Date(), null, null);
        this.viewYear = base.year;
        this.viewMonth = base.month;
    }

    render(container: HTMLElement): HTMLElement {
        // A popup positioned via getBoundingClientRect()+position:fixed, or portaled onto
        // document.body/the modal root, turned out unreliable: Obsidian's Modal can trap pointer
        // interaction to its own subtree, and any transformed ancestor breaks fixed-position math
        // silently. Instead the popup is a plain position:absolute child of this wrapper — a
        // completely ordinary, already-interactive part of the same DOM subtree as everything
        // else in the form, so none of that applies.
        this.wrapEl = container.createDiv({ cls: "fn-datetime-wrap" });
        this.buttonEl = this.wrapEl.createEl("button", {
            type: "button",
            cls: "fn-datetime-trigger",
            attr: { "aria-label": this.options.ariaLabel },
        });
        this.updateButtonText();
        this.buttonEl.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.toggle();
        });
        return this.wrapEl;
    }

    destroy(): void {
        this.closePopup();
    }

    private toggle(): void {
        if (this.popupEl) this.closePopup();
        else this.openPopup();
    }

    private updateButtonText(): void {
        this.buttonEl.setText(formatDisplayValue(this.parts) || "Set date…");
        this.buttonEl.toggleClass("fn-datetime-trigger--empty", this.parts === null);
    }

    private openPopup(): void {
        const popup = this.wrapEl.createDiv({ cls: "fn-datetime-popup" });
        this.popupEl = popup;
        this.renderPopupContent(popup);
        this.applyOverflowGuard(popup);
        // Deferred so the click that opened the popup doesn't immediately close it via bubbling.
        window.setTimeout(() => {
            document.addEventListener("click", this.onOutsideClick);
            document.addEventListener("keydown", this.onKeyDown);
        }, 0);
    }

    private closePopup(): void {
        if (!this.popupEl) return;
        this.popupEl.remove();
        this.popupEl = null;
        document.removeEventListener("click", this.onOutsideClick);
        document.removeEventListener("keydown", this.onKeyDown);
    }

    /** Flips right-aligned when the default left-aligned popup would overflow the viewport's right edge. */
    private applyOverflowGuard(popup: HTMLElement): void {
        const rect = popup.getBoundingClientRect();
        popup.toggleClass("fn-datetime-popup--align-right", rect.right > window.innerWidth - 8);
    }

    private renderPopupContent(popup: HTMLElement): void {
        popup.empty();
        this.renderMonthHeader(popup);
        this.renderWeekdayRow(popup);
        this.renderDayGrid(popup);
        if (this.options.requireTime) this.renderTimeRow(popup);
        this.renderFooter(popup);
    }

    private renderMonthHeader(popup: HTMLElement): void {
        const header = popup.createDiv({ cls: "fn-datetime-popup-header" });
        const prev = header.createEl("button", {
            type: "button",
            cls: "fn-datetime-popup-nav",
            attr: { "aria-label": "Previous month" },
        });
        prev.setText("‹");
        prev.addEventListener("click", () => this.shiftMonth(-1));
        header.createSpan({
            cls: "fn-datetime-popup-title",
            text: `${MONTH_LABELS[this.viewMonth - 1]} ${this.viewYear}`,
        });
        const next = header.createEl("button", {
            type: "button",
            cls: "fn-datetime-popup-nav",
            attr: { "aria-label": "Next month" },
        });
        next.setText("›");
        next.addEventListener("click", () => this.shiftMonth(1));
    }

    private shiftMonth(delta: number): void {
        const total = this.viewYear * 12 + (this.viewMonth - 1) + delta;
        this.viewYear = Math.floor(total / 12);
        this.viewMonth = (((total % 12) + 12) % 12) + 1;
        if (this.popupEl) this.renderPopupContent(this.popupEl);
    }

    private renderWeekdayRow(popup: HTMLElement): void {
        const row = popup.createDiv({ cls: "fn-datetime-popup-weekdays" });
        for (const label of WEEKDAY_LABELS) row.createSpan({ text: label });
    }

    private renderDayGrid(popup: HTMLElement): void {
        const grid = popup.createDiv({ cls: "fn-datetime-popup-grid" });
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
            cls: "fn-datetime-popup-day",
            text: String(cell.day),
        });
        button.toggleClass("fn-datetime-popup-day--outside", !cell.inCurrentMonth);
        button.toggleClass("fn-datetime-popup-day--today", isSameDay(cellParts, today));
        button.toggleClass("fn-datetime-popup-day--selected", this.parts !== null && isSameDay(cellParts, this.parts));
        button.addEventListener("click", () => this.selectDay(cell));
    }

    private selectDay(cell: CalendarCell): void {
        const hour = this.parts?.hour ?? (this.options.requireTime ? 0 : null);
        const minute = this.parts?.minute ?? (this.options.requireTime ? 0 : null);
        this.parts = { year: cell.year, month: cell.month, day: cell.day, hour, minute };
        this.emit();
        this.updateButtonText();
        if (this.popupEl) this.renderPopupContent(this.popupEl);
    }

    private renderTimeRow(popup: HTMLElement): void {
        const row = popup.createDiv({ cls: "fn-datetime-popup-time" });
        const hourInput = row.createEl("input", {
            type: "number",
            cls: "fn-datetime-popup-time-input",
            attr: { min: "0", max: "23", "aria-label": "Hour (24-hour)" },
        });
        hourInput.value = this.parts?.hour !== null && this.parts?.hour !== undefined ? String(this.parts.hour) : "0";
        row.createSpan({ text: ":", cls: "fn-datetime-popup-time-sep" });
        const minuteInput = row.createEl("input", {
            type: "number",
            cls: "fn-datetime-popup-time-input",
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
            this.updateButtonText();
        };
        hourInput.addEventListener("change", commit);
        minuteInput.addEventListener("change", commit);
    }

    private renderFooter(popup: HTMLElement): void {
        const footer = popup.createDiv({ cls: "fn-datetime-popup-footer" });
        const todayBtn = footer.createEl("button", { type: "button", text: "Today" });
        todayBtn.addEventListener("click", () => {
            const now = new Date();
            this.selectDay({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate(), inCurrentMonth: true });
            if (this.options.requireTime) {
                this.parts = { ...this.parts!, hour: now.getHours(), minute: now.getMinutes() };
                this.emit();
                this.updateButtonText();
                if (this.popupEl) this.renderPopupContent(this.popupEl);
            }
        });
        const clearBtn = footer.createEl("button", { type: "button", text: "Clear" });
        clearBtn.addEventListener("click", () => {
            this.parts = null;
            this.emit();
            this.updateButtonText();
            this.closePopup();
        });
        const doneBtn = footer.createEl("button", { type: "button", cls: "mod-cta", text: "Done" });
        doneBtn.addEventListener("click", () => this.closePopup());
    }

    private emit(): void {
        this.options.onChange(this.parts ? formatCanonicalValue(this.parts) : null);
    }
}

function clamp(value: number, min: number, max: number): number {
    if (Number.isNaN(value)) return min;
    return Math.min(max, Math.max(min, value));
}
