import flatpickr from "flatpickr";
import type { Instance as FlatpickrInstance } from "flatpickr/dist/types/instance";
import type { Options as FlatpickrOptions } from "flatpickr/dist/types/options";
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
 * unreachable.
 *
 * By default flatpickr appends its calendar straight to document.body, outside the Obsidian
 * `Modal` this input usually lives in — which is exactly what keeps the calendar's *day* clicks
 * working (clicking one only needs a "click" listener to fire) but silently breaks *typing* into
 * its year/hour/minute/month-dropdown inputs (that needs the input to actually keep keyboard
 * focus, and something in Obsidian's modal focus handling steals it back once focus lands on an
 * element the Modal doesn't consider its own — a well-documented flatpickr-in-a-modal failure
 * mode, not specific to this app). buildModalPositionConfig below appends the calendar inside the
 * nearest `.modal` instead, which keeps it inside whatever DOM subtree that focus handling
 * respects, and supplies a `position` function that reproduces flatpickr's own
 * below-input/flip-above-if-cramped placement math but relative to that `.modal` (its actual new
 * containing block) instead of the page — flatpickr's own math assumes a document.body-relative
 * containing block and renders in the wrong place otherwise.
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
            locale: { firstDayOfWeek: 1 },
            weekNumbers: true,
            defaultDate: initial ? toJsDate(initial) : undefined,
            onChange: (selectedDates) => this.emit(selectedDates[0] ?? null),
            ...buildModalPositionConfig(container, this.dateInputEl),
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

/** Empty (flatpickr's own document.body append is used unchanged) when `container` isn't inside a
 * `.modal` — e.g. mobile's full-screen forms, which don't have this focus-handling conflict. */
function buildModalPositionConfig(container: HTMLElement, positionElement: HTMLElement): Partial<FlatpickrOptions> {
    const modalEl = container.closest<HTMLElement>(".modal");
    if (!modalEl) return {};
    const margin = 8;
    return {
        appendTo: modalEl,
        position: (instance) => {
            const calendar = instance.calendarContainer;
            const inputBounds = positionElement.getBoundingClientRect();
            const hostBounds = modalEl.getBoundingClientRect();
            const calendarHeight = Array.from(calendar.children).reduce(
                (total, child) => total + (child as HTMLElement).offsetHeight,
                0,
            );
            const showOnTop =
                window.innerHeight - inputBounds.bottom < calendarHeight && inputBounds.top > calendarHeight;
            calendar.classList.toggle("arrowTop", !showOnTop);
            calendar.classList.toggle("arrowBottom", showOnTop);
            const top = inputBounds.top - hostBounds.top + (showOnTop ? -calendarHeight - 2 : positionElement.offsetHeight + 2);
            const left = inputBounds.left - hostBounds.left;
            const maxLeft = Math.max(margin, hostBounds.width - calendar.offsetWidth - margin);
            const maxTop = Math.max(margin, hostBounds.height - calendarHeight - margin);
            calendar.style.top = `${Math.min(Math.max(top, margin), maxTop)}px`;
            calendar.style.left = `${Math.min(Math.max(left, margin), maxLeft)}px`;
            calendar.style.right = "auto";
        },
    };
}
