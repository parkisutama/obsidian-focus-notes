import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("DateTimeInput wraps flatpickr for the date and plain <select> dropdowns for 24-hour time, not native date/time inputs", async () => {
    const source = await readFile(
        new URL("../src/infrastructure/obsidian/datetime/DateTimeInput.ts", import.meta.url),
        "utf8",
    );
    assert.doesNotMatch(source, /type: "date"|type: "time"|type: "datetime-local"/);
    assert.match(source, /import flatpickr from "flatpickr"/);
    assert.match(source, /dateFormat: "d\/m\/Y"/);
    assert.match(source, /createEl\("select"/);
    assert.match(source, /for \(let h = 0; h < 24; h\+\+\)/);
    assert.match(source, /for \(let m = 0; m < 60; m\+\+\)/);
    assert.match(source, /destroy\(\): void \{\s*this\.fp\.destroy\(\);/);
});

test("styles.css vendors flatpickr's CSS and themes it with Obsidian variables", async () => {
    const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
    assert.match(css, /Vendored: flatpickr/);
    assert.match(css, /\.flatpickr-day\.today/);
    assert.match(css, /\.flatpickr-day\.selected/);
    assert.match(css, /\.fn-datetime-input-wrap \{/);
    assert.match(css, /\.fn-datetime-time-select \{/);
});
