import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("MobileDateTimePicker expands inline (no floating popup/document listeners) and uses the same locale-free formatting", async () => {
    const source = await readFile(
        new URL("../src/features/capture/scheduled-item/ui/mobile/MobileDateTimePicker.ts", import.meta.url),
        "utf8",
    );
    assert.doesNotMatch(source, /type: "date"|type: "time"|type: "datetime-local"/);
    assert.doesNotMatch(source, /document\.addEventListener/);
    assert.doesNotMatch(source, /document\.body\.createDiv/);
    assert.match(source, /formatDisplayValue/);
    assert.match(source, /buildCalendarWeeks/);
    assert.match(source, /type: "number"/);
    assert.match(source, /min: "0", max: "23"/);
    assert.match(source, /min: "0", max: "59"/);
});
