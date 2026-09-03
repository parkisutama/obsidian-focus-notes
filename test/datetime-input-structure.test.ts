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
    assert.match(source, /clickOpens: false/);
    assert.match(source, /enableTime: this\.requireTime/);
    assert.match(source, /time_24hr: true/);
    assert.match(source, /locale: \{ firstDayOfWeek: 1 \}/);
    assert.match(source, /weekNumbers: true/);
    assert.match(source, /minuteIncrement: 1/);
    assert.match(source, /cls: "fn-datetime-today"/);
    assert.match(source, /this\.fp\.setDate\(new Date\(\), true\)/);
    assert.match(source, /destroy\(\): void \{\s*this\.fp\.destroy\(\);/);
});

test("DateTimeInput opens the calendar only from a dedicated icon button that never focuses the text input, so opening it can't summon the on-screen keyboard on mobile", async () => {
    const source = await readFile(
        new URL("../src/infrastructure/obsidian/datetime/DateTimeInput.ts", import.meta.url),
        "utf8",
    );
    assert.match(source, /import \{ setIcon \} from "obsidian"/);
    assert.match(source, /cls: "fn-datetime-toggle"/);
    assert.match(source, /setIcon\(toggleBtn, "calendar"\)/);
    assert.match(source, /document\.activeElement\.blur\(\)/);
    assert.match(source, /this\.fp\.open\(\)/);
    assert.doesNotMatch(source, /toggleBtn[\s\S]*?dateInputEl\.focus\(\)/);
});

test("DateTimeInput takes over wheel handling on the hour/minute inputs so it stays in sync with flatpickr's own state on every tick, instead of relying on native step-on-scroll", async () => {
    const source = await readFile(
        new URL("../src/infrastructure/obsidian/datetime/DateTimeInput.ts", import.meta.url),
        "utf8",
    );
    assert.match(source, /"wheel",[\s\S]*?event\.preventDefault\(\);/);
    assert.match(source, /\{ passive: false \}/);
    assert.match(source, /this\.fp\.setDate\(next, true\);/);
});

test("DateTimeInput appends flatpickr's calendar inside the nearest .modal, with its own host-relative position function, instead of flatpickr's default document.body append", async () => {
    const source = await readFile(
        new URL("../src/infrastructure/obsidian/datetime/DateTimeInput.ts", import.meta.url),
        "utf8",
    );
    assert.match(source, /function buildModalPositionConfig/);
    assert.match(source, /container\.closest<HTMLElement>\("\.modal"\)/);
    assert.match(source, /appendTo: modalEl/);
    assert.match(source, /position: \(instance\) => \{/);
    assert.match(source, /\.\.\.buildModalPositionConfig\(container, this\.dateInputEl\)/);
});

test("buildModalPositionConfig clamps the calendar's left/top within the modal's own bounds, so it can't force a new scrollbar on the modal", async () => {
    const source = await readFile(
        new URL("../src/infrastructure/obsidian/datetime/DateTimeInput.ts", import.meta.url),
        "utf8",
    );
    assert.match(source, /const maxLeft = Math\.max\(margin, hostBounds\.width - calendar\.offsetWidth - margin\);/);
    assert.match(source, /const maxTop = Math\.max\(margin, hostBounds\.height - calendarHeight - margin\);/);
    assert.match(source, /Math\.min\(Math\.max\(top, margin\), maxTop\)/);
    assert.match(source, /Math\.min\(Math\.max\(left, margin\), maxLeft\)/);
});

test("styles.css vendors flatpickr's CSS and themes it (including the time spin-input row) with Obsidian variables", async () => {
    const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
    assert.match(css, /Vendored: flatpickr/);
    assert.match(css, /\.flatpickr-day\.today/);
    assert.match(css, /\.flatpickr-day\.selected/);
    assert.match(css, /\.flatpickr-time /);
    assert.match(css, /\.flatpickr-weekwrapper \.flatpickr-weeks \{\s*box-shadow: 1px 0 0 var\(--background-modifier-border\);/);
    assert.match(css, /\.fn-datetime-input-wrap \{/);
    assert.match(css, /\.fn-datetime-toggle \{/);
    assert.match(css, /\.fn-datetime-today,\s*\.fn-datetime-clear \{/);
});

test("styles.css shrinks flatpickr's fixed default dimensions so the calendar (including the time row) needs less vertical space", async () => {
    const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
    assert.match(css, /Compact sizing for vendored flatpickr/);
    assert.match(
        css,
        /\.flatpickr-calendar,\s*\.flatpickr-days,\s*\.dayContainer \{\s*width: 266px;\s*\}/,
    );
    assert.match(css, /\.dayContainer \{\s*min-width: 266px;\s*max-width: 266px;\s*\}/);
    assert.match(css, /\.flatpickr-day \{\s*max-width: 34px;\s*height: 34px;\s*line-height: 34px;\s*\}/);
});
