import assert from "node:assert/strict";
import test from "node:test";
import {
    formatCanonicalValue,
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
