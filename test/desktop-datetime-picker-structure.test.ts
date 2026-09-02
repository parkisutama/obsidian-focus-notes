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

test("popup outranks the modal it opens from and clamps to the viewport instead of overflowing", async () => {
    const source = await readFile(
        new URL("../src/features/capture/scheduled-item/ui/desktop/DesktopDateTimePicker.ts", import.meta.url),
        "utf8",
    );
    assert.match(source, /window\.innerWidth - width - margin/);
    assert.match(source, /window\.innerHeight - margin/);

    const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
    assert.match(css, /\.fn-datetime-popup\s*\{\s*\/\*[\s\S]*?z-index: calc\(var\(--layer-modal, 1000\) \+ 10\);/);
});

test("popup mounts inside the modal it opens from instead of document.body, so it stays interactive", async () => {
    const source = await readFile(
        new URL("../src/features/capture/scheduled-item/ui/desktop/DesktopDateTimePicker.ts", import.meta.url),
        "utf8",
    );
    assert.match(source, /this\.buttonEl\.closest<HTMLElement>\("\.modal"\) \?\? document\.body/);
    assert.doesNotMatch(source, /document\.body\.createDiv/);
});
