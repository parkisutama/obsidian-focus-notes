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

test("popup is a plain position:absolute child of the trigger's own wrapper — no portal, no fixed positioning", async () => {
    const source = await readFile(
        new URL("../src/features/capture/scheduled-item/ui/desktop/DesktopDateTimePicker.ts", import.meta.url),
        "utf8",
    );
    // These are exactly the two failure modes that made earlier portal-based attempts
    // unclickable/misplaced: Obsidian's Modal traps pointer interaction to its own subtree, and a
    // transformed ancestor silently breaks position:fixed's viewport-relative math.
    assert.doesNotMatch(source, /document\.body\.createDiv/);
    assert.doesNotMatch(source, /\.closest<HTMLElement>\("\.modal"\)/);
    assert.doesNotMatch(source, /style\.position = "fixed"/);
    assert.match(source, /this\.wrapEl = container\.createDiv\(\{ cls: "fn-datetime-wrap" \}\)/);
    assert.match(source, /this\.wrapEl\.createDiv\(\{ cls: "fn-datetime-popup" \}\)/);

    const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
    assert.match(css, /\.fn-datetime-wrap \{\s*position: relative;/);
    assert.match(css, /\.fn-datetime-popup \{\s*position: absolute;/);
});
