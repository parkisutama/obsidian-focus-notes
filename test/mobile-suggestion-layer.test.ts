import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("renders Obsidian suggestions above the custom mobile editor", () => {
    assert.match(
        styles,
        /body\.fn-mobile-event-screen-open \.suggestion-container\s*\{[^}]*z-index:\s*calc\(var\(--layer-modal, 1000\) \+ 20\)\s*!important;/s,
    );
});
