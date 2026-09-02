import assert from "node:assert/strict";
import test from "node:test";
import {
    buildCalendarWeeks,
    formatCanonicalValue,
    formatDisplayValue,
    isSameDay,
    parseCanonicalValue,
    partsFromJsDate,
    toJsDate,
} from "../src/features/capture/scheduled-item/domain/DateTimeFormat.ts";

test("parses a date-only canonical value", () => {
    assert.deepEqual(parseCanonicalValue("2026-09-02"), {
        year: 2026,
        month: 9,
        day: 2,
        hour: null,
        minute: null,
    });
});

test("parses a canonical value with time", () => {
    assert.deepEqual(parseCanonicalValue("2026-09-02 15:54"), {
        year: 2026,
        month: 9,
        day: 2,
        hour: 15,
        minute: 54,
    });
});

test("rejects null, empty, malformed, and non-existent calendar dates", () => {
    assert.equal(parseCanonicalValue(null), null);
    assert.equal(parseCanonicalValue(""), null);
    assert.equal(parseCanonicalValue("02/09/2026"), null);
    assert.equal(parseCanonicalValue("2026-13-01"), null);
    assert.equal(parseCanonicalValue("2026-02-30"), null);
});

test("round-trips canonical formatting for both date-only and date+time", () => {
    const dateOnly = parseCanonicalValue("2026-09-02");
    assert.equal(formatCanonicalValue(dateOnly!), "2026-09-02");

    const withTime = parseCanonicalValue("2026-01-05 09:07");
    assert.equal(formatCanonicalValue(withTime!), "2026-01-05 09:07");
});

test("formats a locale-free DD/MM/YYYY display value, with and without time", () => {
    assert.equal(formatDisplayValue(parseCanonicalValue("2026-09-02 15:54")), "02/09/2026 15:54");
    assert.equal(formatDisplayValue(parseCanonicalValue("2026-01-05")), "05/01/2026");
    assert.equal(formatDisplayValue(null), "");
});

test("converts to and from a JS Date without losing the time-vs-date-only distinction", () => {
    const parts = parseCanonicalValue("2026-09-02 15:54")!;
    const date = toJsDate(parts);
    assert.equal(date.getFullYear(), 2026);
    assert.equal(date.getMonth(), 8);
    assert.equal(date.getDate(), 2);
    assert.equal(date.getHours(), 15);
    assert.equal(date.getMinutes(), 54);

    const rebuilt = partsFromJsDate(date, 15, 54);
    assert.deepEqual(rebuilt, parts);

    const dateOnlyRebuilt = partsFromJsDate(date, null, null);
    assert.equal(formatCanonicalValue(dateOnlyRebuilt), "2026-09-02");
});

test("isSameDay ignores time", () => {
    const a = parseCanonicalValue("2026-09-02 09:00")!;
    const b = parseCanonicalValue("2026-09-02 23:00")!;
    const c = parseCanonicalValue("2026-09-03 09:00")!;
    assert.equal(isSameDay(a, b), true);
    assert.equal(isSameDay(a, c), false);
});

test("builds Monday-first calendar weeks padded with adjacent-month days", () => {
    // September 2026: 1 Sep is a Tuesday, 30 Sep is a Wednesday.
    const weeks = buildCalendarWeeks(2026, 9);
    assert.ok(weeks.every((week) => week.length === 7));

    const firstWeek = weeks[0];
    assert.deepEqual(
        firstWeek.map((cell) => [cell.day, cell.month, cell.inCurrentMonth]),
        [
            [31, 8, false],
            [1, 9, true],
            [2, 9, true],
            [3, 9, true],
            [4, 9, true],
            [5, 9, true],
            [6, 9, true],
        ],
    );

    const lastWeek = weeks[weeks.length - 1];
    assert.deepEqual(
        lastWeek.map((cell) => [cell.day, cell.month, cell.inCurrentMonth]),
        [
            [28, 9, true],
            [29, 9, true],
            [30, 9, true],
            [1, 10, false],
            [2, 10, false],
            [3, 10, false],
            [4, 10, false],
        ],
    );

    const allDays = weeks.flat().filter((cell) => cell.inCurrentMonth);
    assert.equal(allDays.length, 30);
});

test("handles a month starting on Monday with no leading padding, and February in a leap year", () => {
    // February 2027 starts on a Monday.
    const feb2027 = buildCalendarWeeks(2027, 2);
    assert.deepEqual(
        feb2027[0].map((cell) => [cell.day, cell.month, cell.inCurrentMonth]),
        [
            [1, 2, true],
            [2, 2, true],
            [3, 2, true],
            [4, 2, true],
            [5, 2, true],
            [6, 2, true],
            [7, 2, true],
        ],
    );

    // 2028 is a leap year: February has 29 days.
    const feb2028 = buildCalendarWeeks(2028, 2);
    const inMonth = feb2028.flat().filter((cell) => cell.inCurrentMonth);
    assert.equal(inMonth.length, 29);
});
