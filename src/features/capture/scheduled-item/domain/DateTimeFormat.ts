/**
 * Pure parsing/formatting math for the custom date/time picker (replaces native
 * <input type="date"/"time"/"datetime-local">, whose displayed format follows the OS/Electron
 * process locale — something a plugin cannot override; see DateTimeInput.ts for why).
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

export function toJsDate(parts: DateTimeParts): Date {
    return new Date(parts.year, parts.month - 1, parts.day, parts.hour ?? 0, parts.minute ?? 0);
}

export function partsFromJsDate(date: Date, hour: number | null, minute: number | null): DateTimeParts {
    return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(), hour, minute };
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
