import flatpickr from "flatpickr";
import type { Instance as FlatpickrInstance } from "flatpickr/dist/types/instance";
import {
    type DateTimeParts,
    formatCanonicalValue,
    parseCanonicalValue,
    partsFromJsDate,
    toJsDate,
} from "../../../features/capture/scheduled-item/domain/DateTimeFormat.ts";

export interface DateTimeInputOptions {
    initialValue: string | null;
    requireTime: boolean;
    ariaLabel: string;
    onChange(value: string | null): void;
}

/**
 * Reusable DD/MM/YYYY date field (+ optional 24-hour time) usable from any UI — three homegrown
 * popup attempts each fixed one bug and hit another (wrong z-index, an Obsidian Modal trapping
 * pointer events, then an ancestor `overflow` clipping the popup), so the calendar itself is now
 * flatpickr (github.com/flatpickr/flatpickr): a mature, MIT-licensed picker whose positioning
 * engine is specifically built for calendars inside arbitrary, possibly-scrolling containers,
 * with month/year dropdown navigation built in. Not `type="date"`: native pickers follow the
 * OS/Electron process locale, which this plugin can't override (confirmed — see git history).
 *
 * Time is two plain <select> dropdowns (00-23 / 00-59), not flatpickr's own time UI — a dropdown
 * of digits can't have an AM/PM ambiguity, and it's simpler and more robust than embedding a
 * second interactive widget inside the calendar popup.
 */
export class DateTimeInput {
    private readonly dateInputEl: HTMLInputElement;
    private readonly fp: FlatpickrInstance;
    private readonly onChange: (value: string | null) => void;
    private readonly requireTime: boolean;
    private hourSelect: HTMLSelectElement | null = null;
    private minuteSelect: HTMLSelectElement | null = null;
    private dateParts: DateTimeParts | null;
    private hour: number | null;
    private minute: number | null;

    constructor(container: HTMLElement, options: DateTimeInputOptions) {
        this.onChange = options.onChange;
        this.requireTime = options.requireTime;
        const initial = parseCanonicalValue(options.initialValue);
        this.dateParts = initial;
        this.hour = initial?.hour ?? null;
        this.minute = initial?.minute ?? null;

        const wrap = container.createDiv({ cls: "fn-datetime-input-wrap" });
        this.dateInputEl = wrap.createEl("input", {
            type: "text",
            cls: "fn-datetime-input",
            attr: { "aria-label": `${options.ariaLabel} date`, placeholder: "Set date…" },
        });
        this.fp = flatpickr(this.dateInputEl, {
            dateFormat: "d/m/Y",
            allowInput: true,
            defaultDate: initial ? toJsDate(initial) : undefined,
            onChange: (selectedDates) => {
                const date = selectedDates[0];
                this.dateParts = date ? partsFromJsDate(date, null, null) : null;
                if (this.dateParts && this.requireTime && this.hour === null) {
                    this.hour = 0;
                    this.minute = 0;
                    this.syncTimeSelects();
                }
                this.emit();
            },
        });

        const clearBtn = wrap.createEl("button", {
            type: "button",
            cls: "fn-datetime-clear",
            text: "✕",
            attr: { "aria-label": `Clear ${options.ariaLabel}` },
        });
        clearBtn.addEventListener("click", (event) => {
            event.preventDefault();
            this.fp.clear();
            this.hour = null;
            this.minute = null;
            this.syncTimeSelects();
            this.emit();
        });

        if (this.requireTime || (initial?.hour !== null && initial?.hour !== undefined)) {
            this.renderTimeSelects(wrap, options.ariaLabel);
        }
    }

    destroy(): void {
        this.fp.destroy();
    }

    private renderTimeSelects(wrap: HTMLElement, ariaLabel: string): void {
        const timeWrap = wrap.createDiv({ cls: "fn-datetime-time-wrap" });
        this.hourSelect = timeWrap.createEl("select", {
            cls: "fn-datetime-time-select",
            attr: { "aria-label": `${ariaLabel} hour (24-hour)` },
        });
        for (let h = 0; h < 24; h++) {
            this.hourSelect.createEl("option", { value: String(h), text: String(h).padStart(2, "0") });
        }
        timeWrap.createSpan({ text: ":", cls: "fn-datetime-time-sep" });
        this.minuteSelect = timeWrap.createEl("select", {
            cls: "fn-datetime-time-select",
            attr: { "aria-label": `${ariaLabel} minute` },
        });
        for (let m = 0; m < 60; m++) {
            this.minuteSelect.createEl("option", { value: String(m), text: String(m).padStart(2, "0") });
        }
        this.syncTimeSelects();
        this.hourSelect.addEventListener("change", () => {
            this.hour = parseInt(this.hourSelect?.value ?? "0", 10);
            this.emit();
        });
        this.minuteSelect.addEventListener("change", () => {
            this.minute = parseInt(this.minuteSelect?.value ?? "0", 10);
            this.emit();
        });
    }

    private syncTimeSelects(): void {
        if (this.hourSelect) this.hourSelect.value = String(this.hour ?? 0);
        if (this.minuteSelect) this.minuteSelect.value = String(this.minute ?? 0);
    }

    private emit(): void {
        if (!this.dateParts) {
            this.onChange(null);
            return;
        }
        const hasTime = this.hour !== null && this.minute !== null;
        const parts: DateTimeParts = {
            ...this.dateParts,
            hour: hasTime ? this.hour : null,
            minute: hasTime ? this.minute : null,
        };
        this.onChange(formatCanonicalValue(parts));
    }
}
