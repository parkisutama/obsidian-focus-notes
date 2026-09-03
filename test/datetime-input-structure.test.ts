import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("DateTimeInput wraps flatpickr for the date grid and its own 24-hour spin-input time row, not native date/time inputs or a <select>", async () => {
    const source = await readFile(
        new URL("../src/infrastructure/obsidian/datetime/DateTimeInput.ts", import.meta.url),
        "utf8",
    );
    assert.doesNotMatch(source, /type: "date"|type: "time"|type: "datetime-local"/);
    assert.doesNotMatch(source, /createEl\("select"/);
    assert.match(source, /import flatpickr from "flatpickr"/);
    assert.match(source, /dateFormat: this\.requireTime \? "d\/m\/Y H:i" : "d\/m\/Y"/);
    assert.match(source, /enableTime: this\.requireTime/);
    assert.match(source, /time_24hr: true/);
    assert.match(source, /monthSelectorType: "static"/);
    assert.match(source, /locale: \{ firstDayOfWeek: 1 \}/);
    assert.match(source, /weekNumbers: true/);
    assert.match(source, /cls: "fn-datetime-today"/);
    assert.match(source, /this\.fp\.setDate\(new Date\(\), true\)/);
    assert.match(source, /destroy\(\): void \{\s*this\.fp\.destroy\(\);/);
});

test("styles.css vendors flatpickr's CSS and themes it (including the time spin-input row) with Obsidian variables", async () => {
    const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
    assert.match(css, /Vendored: flatpickr/);
    assert.match(css, /\.flatpickr-day\.today/);
    assert.match(css, /\.flatpickr-day\.selected/);
    assert.match(css, /\.flatpickr-time /);
    assert.match(css, /\.flatpickr-weekwrapper \.flatpickr-weeks \{\s*box-shadow: 1px 0 0 var\(--background-modifier-border\);/);
    assert.match(css, /\.fn-datetime-input-wrap \{/);
    assert.match(css, /\.fn-datetime-today,\s*\.fn-datetime-clear \{/);
});
