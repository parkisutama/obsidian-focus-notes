/**
 * Pure parsing/formatting/calendar-grid math for the custom date/time picker (replaces native
 * <input type="date"/"time"/"datetime-local">, whose displayed format follows the OS/Electron
 * process locale — something a plugin cannot override; see DesktopDateTimePicker.ts for why).
 *
 * The app's canonical string shape stays exactly what ScheduledItemFormAdapter.parseLocalDateTime
 * already expects: "YYYY-MM-DD" or "YYYY-MM-DD HH:mm".
 */
export interface DateTimeParts {
    year: number;
    month: number; // 1-12
    day: number;
    /** Both null for a date-only value; both set for a value with time. */
    hour: number | null;
    minute: number | null;
}

const CANONICAL_RE = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?$/;

/** Null for an empty/malformed value, or one that doesn't round-trip (e.g. 2026-02-30). */
export function parseCanonicalValue(value: string | null | undefined): DateTimeParts | null {
    if (!value) return null;
    const match = value.match(CANONICAL_RE);
    if (!match) return null;
    const [year, month, day, hour, minute] = [match[1], match[2], match[3], match[4], match[5]].map((part) =>
        part === undefined ? null : Number(part),
    );
    const parts: DateTimeParts = { year: year as number, month: month as number, day: day as number, hour, minute };
    return isValidParts(parts) ? parts : null;
}

export function formatCanonicalValue(parts: DateTimeParts): string {
    const date = `${pad4(parts.year)}-${pad2(parts.month)}-${pad2(parts.day)}`;
    if (parts.hour === null || parts.minute === null) return date;
    return `${date} ${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

/** "02/09/2026 15:54", "02/09/2026" (no time), or "" for null — never locale-dependent. */
export function formatDisplayValue(parts: DateTimeParts | null): string {
    if (!parts) return "";
    const date = `${pad2(parts.day)}/${pad2(parts.month)}/${pad4(parts.year)}`;
    if (parts.hour === null || parts.minute === null) return date;
    return `${date} ${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

export function toJsDate(parts: DateTimeParts): Date {
    return new Date(parts.year, parts.month - 1, parts.day, parts.hour ?? 0, parts.minute ?? 0);
}

export function partsFromJsDate(date: Date, hour: number | null, minute: number | null): DateTimeParts {
    return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(), hour, minute };
}

export function isSameDay(a: DateTimeParts, b: DateTimeParts): boolean {
    return a.year === b.year && a.month === b.month && a.day === b.day;
}

export interface CalendarCell {
    year: number;
    month: number; // 1-12
    day: number;
    /** False for a leading/trailing day borrowed from the adjacent month to fill the grid. */
    inCurrentMonth: boolean;
}

/**
 * Monday-first weeks (en-GB/ISO convention) covering the full month, padded with adjacent-month
 * days so every week has exactly 7 cells.
 */
export function buildCalendarWeeks(year: number, month: number): CalendarCell[][] {
    const firstOfMonth = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    // getDay(): 0=Sunday..6=Saturday. Convert to Monday-first offset (0=Monday..6=Sunday).
    const leadingCount = (firstOfMonth.getDay() + 6) % 7;

    const cells: CalendarCell[] = [];
    for (let i = leadingCount; i > 0; i--) {
        const d = new Date(year, month - 1, 1 - i);
        cells.push({ year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), inCurrentMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day++) {
        cells.push({ year, month, day, inCurrentMonth: true });
    }
    while (cells.length % 7 !== 0) {
        const last = cells[cells.length - 1];
        const d = new Date(last.year, last.month - 1, last.day + 1);
        cells.push({ year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), inCurrentMonth: false });
    }

    const weeks: CalendarCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
}

function isValidParts(parts: DateTimeParts): boolean {
    if ((parts.hour === null) !== (parts.minute === null)) return false;
    const date = toJsDate(parts);
    if (
        date.getFullYear() !== parts.year ||
        date.getMonth() !== parts.month - 1 ||
        date.getDate() !== parts.day
    ) {
        return false;
    }
    if (parts.hour !== null && (parts.hour < 0 || parts.hour > 23)) return false;
    if (parts.minute !== null && (parts.minute < 0 || parts.minute > 59)) return false;
    return true;
}

function pad2(n: number): string {
    return String(n).padStart(2, "0");
}

function pad4(n: number): string {
    return String(n).padStart(4, "0");
}
