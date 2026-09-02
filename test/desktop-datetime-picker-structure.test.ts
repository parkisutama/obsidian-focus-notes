import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("DesktopDateTimePicker builds its display/parse from the locale-free DateTimeFormat module, not native inputs", async () => {
    const source = await readFile(
        new URL("../src/features/capture/scheduled-item/ui/desktop/DesktopDateTimePicker.ts", import.meta.url),
        "utf8",
    );
    assert.doesNotMatch(source, /type: "date"|type: "time"|type: "datetime-local"/);
    assert.match(source, /formatDisplayValue/);
    assert.match(source, /buildCalendarWeeks/);
    assert.match(source, /type: "number"/);
    assert.match(source, /min: "0", max: "23"/);
    assert.match(source, /min: "0", max: "59"/);
    assert.match(source, /document\.addEventListener\("click", this\.onOutsideClick\)/);
    assert.match(source, /document\.addEventListener\("keydown", this\.onKeyDown\)/);
});
