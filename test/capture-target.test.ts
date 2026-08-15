import assert from "node:assert/strict";
import test from "node:test";
import { preferActiveNoteTarget } from "../src/CaptureTarget.ts";

const configured = { file: "Daily/2026-08-03.md", heading: "Activities & Tasks", position: "end" as const };

test("prefers the active Markdown note without changing heading or position", () => {
    assert.deepEqual(preferActiveNoteTarget(configured, "Projects/Client Alpha.md"), {
        file: "Projects/Client Alpha.md",
        heading: "Activities & Tasks",
        position: "end",
    });
});

test("falls back to the configured target without an active Markdown note", () => {
    assert.deepEqual(preferActiveNoteTarget(configured, null), configured);
    assert.deepEqual(preferActiveNoteTarget(configured, ""), configured);
    assert.deepEqual(preferActiveNoteTarget(configured, "Assets/map.png"), configured);
});
