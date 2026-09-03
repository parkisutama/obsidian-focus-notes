import flatpickr from "flatpickr";
import type { Instance as FlatpickrInstance } from "flatpickr/dist/types/instance";
import {
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
 * engine is specifically built for calendars inside arbitrary, possibly-scrolling containers.
 * Not `type="date"`: native pickers follow the OS/Electron process locale, which this plugin
 * can't override (confirmed — see git history).
 *
 * Time uses flatpickr's own 24-hour spin-input row (enableTime), not a plain <select> — a native
 * <select> with 24/60 <option>s was tried first, but its dropdown popup doesn't reliably
 * clamp/scroll inside Obsidian's Electron window, leaving the higher hour/minute values
 * unreachable. The month name is static text rather than flatpickr's month <select>
 * (monthSelectorType) for the same reason — the prev/next arrows and the year spin-input already
 * cover navigation without an unreliable native popup.
 *
 * Weeks start Monday (locale.firstDayOfWeek) with the ISO 8601 week number shown alongside each
 * row (weekNumbers) — flatpickr's default getWeek already implements the ISO 8601 algorithm
 * (Thursday-of-the-week decides the week's year), so no override is needed for the number itself.
 *
 * The hour/minute spin-inputs are plain `<input type="number">`, so a mouse wheel over a focused
 * one steps its value using the browser's own native handling — but that only mutates the input's
 * DOM value; flatpickr doesn't notice until the input blurs (it syncs on blur or on its own
 * synthetic "increment" event from an arrow-key press or spinner click, not on wheel), so scrolling
 * both fields in the same gesture, or scrolling and then reading the picker's emitted value before
 * blurring, desyncs what's on screen from what's actually selected. attachTimeWheelControl takes
 * wheel handling over entirely — one input's worth of hour or minute at a time, wrapping at the
 * 24/60 boundary — and drives it through `fp.setDate` so flatpickr's own state, its redraw, and
 * this component's onChange all update atomically on every tick.
 */
export class DateTimeInput {
    private readonly dateInputEl: HTMLInputElement;
    private readonly fp: FlatpickrInstance;
    private readonly onChange: (value: string | null) => void;
    private readonly requireTime: boolean;

    constructor(container: HTMLElement, options: DateTimeInputOptions) {
        this.onChange = options.onChange;
        this.requireTime = options.requireTime;
        const initial = parseCanonicalValue(options.initialValue);

        const wrap = container.createDiv({ cls: "fn-datetime-input-wrap" });
        this.dateInputEl = wrap.createEl("input", {
            type: "text",
            cls: "fn-datetime-input",
            attr: { "aria-label": `${options.ariaLabel} date`, placeholder: "Set date…" },
        });
        this.fp = flatpickr(this.dateInputEl, {
            dateFormat: this.requireTime ? "d/m/Y H:i" : "d/m/Y",
            allowInput: true,
            enableTime: this.requireTime,
            time_24hr: true,
            defaultHour: 0,
            defaultMinute: 0,
            minuteIncrement: 1,
            monthSelectorType: "static",
            locale: { firstDayOfWeek: 1 },
            weekNumbers: true,
            defaultDate: initial ? toJsDate(initial) : undefined,
            onChange: (selectedDates) => this.emit(selectedDates[0] ?? null),
        });
        if (this.requireTime) this.attachTimeWheelControl();

        const todayBtn = wrap.createEl("button", {
            type: "button",
            cls: "fn-datetime-today",
            text: "Today",
            attr: { "aria-label": `Set ${options.ariaLabel} to today` },
        });
        todayBtn.addEventListener("click", (event) => {
            event.preventDefault();
            this.fp.setDate(new Date(), true);
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
        });
    }

    destroy(): void {
        this.fp.destroy();
    }

    private attachTimeWheelControl(): void {
        this.attachWheelStep(this.fp.hourElement, "hours", 23);
        this.attachWheelStep(this.fp.minuteElement, "minutes", 59);
    }

    private attachWheelStep(input: HTMLInputElement | undefined, unit: "hours" | "minutes", max: number): void {
        if (!input) return;
        input.addEventListener(
            "wheel",
            (event) => {
                event.preventDefault();
                const next = new Date(this.fp.selectedDates[0] ?? new Date());
                const delta = event.deltaY < 0 ? 1 : -1;
                const current = unit === "hours" ? next.getHours() : next.getMinutes();
                const wrapped = ((current + delta) % (max + 1) + (max + 1)) % (max + 1);
                if (unit === "hours") next.setHours(wrapped);
                else next.setMinutes(wrapped);
                this.fp.setDate(next, true);
            },
            { passive: false },
        );
    }

    private emit(date: Date | null): void {
        if (!date) {
            this.onChange(null);
            return;
        }
        const parts = partsFromJsDate(date, this.requireTime ? date.getHours() : null, this.requireTime ? date.getMinutes() : null);
        this.onChange(formatCanonicalValue(parts));
    }
}
