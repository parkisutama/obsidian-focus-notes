import assert from "node:assert/strict";
import test from "node:test";
import { resolveEventCaptureTarget } from "../src/features/capture/scheduled-item/application/ScheduledItemCaptureTarget.ts";

const settingsTarget = { heading: "Activities & Tasks", position: "start" as const };

test("ordinary Event capture keeps the configured periodical file and Event placement", () => {
    assert.deepEqual(
        resolveEventCaptureTarget(
            { file: "Daily/2026-08-30.md", heading: "Profile heading", position: "end" },
            settingsTarget,
        ),
        { file: "Daily/2026-08-30.md", heading: "Activities & Tasks", position: "start" },
    );
});

test("explicit contextual Event target overrides only the automatic file", () => {
    assert.deepEqual(
        resolveEventCaptureTarget(
            { file: "Daily/2026-08-30.md", heading: "Profile heading", position: "end" },
            settingsTarget,
            "Projects/Client Alpha.md",
        ),
        { file: "Projects/Client Alpha.md", heading: "Activities & Tasks", position: "start" },
    );
});

test("missing profile remains visible as an empty target without ambient fallback", () => {
    assert.deepEqual(resolveEventCaptureTarget(null, settingsTarget), {
        file: "",
        heading: "Activities & Tasks",
        position: "start",
    });
});

test("empty Event heading falls back to the resolved profile heading", () => {
    assert.deepEqual(
        resolveEventCaptureTarget(
            { file: "Daily/2026-08-30.md", heading: "Profile heading", position: "end" },
            { heading: "", position: "start" },
        ),
        { file: "Daily/2026-08-30.md", heading: "Profile heading", position: "start" },
    );
});
