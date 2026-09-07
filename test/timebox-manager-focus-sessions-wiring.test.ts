import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Planning managers keep actual Focus Sessions outside the planning surface", async () => {
    for (const path of [
        "../src/features/capture/scheduled-item/ui/desktop/TimeboxManagerModal.ts",
        "../src/features/capture/scheduled-item/ui/mobile/TimeboxManagerMobileScreen.ts",
    ]) {
        const source = await readFile(new URL(path, import.meta.url), "utf8");
        assert.doesNotMatch(source, /fn-timebox-focus-sessions|ScannedFocusSession/);
        assert.match(source, /Planning|Manage timeboxes/);
    }
});
