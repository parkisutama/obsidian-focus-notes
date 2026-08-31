import assert from "node:assert/strict";
import test from "node:test";
import {
    fromDateTimeLocalValue,
    toDateTimeLocalValue,
} from "../src/features/capture/scheduled-item/domain/ScheduledItemFormAdapter.ts";

test("converts this app's space-separated local datetime to the native datetime-local value format", () => {
    assert.equal(toDateTimeLocalValue("2026-08-31 09:00"), "2026-08-31T09:00");
});

test("converts a native datetime-local value back to this app's space-separated format", () => {
    assert.equal(fromDateTimeLocalValue("2026-08-31T09:00"), "2026-08-31 09:00");
});

test("round-trips losslessly in both directions", () => {
    const original = "2026-08-31 09:00";
    assert.equal(fromDateTimeLocalValue(toDateTimeLocalValue(original)), original);
});

test("passes an empty string through unchanged in both directions", () => {
    assert.equal(toDateTimeLocalValue(""), "");
    assert.equal(fromDateTimeLocalValue(""), "");
});
