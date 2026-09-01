import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

for (const path of [
    "../src/features/capture/scheduled-item/ui/desktop/TimeboxManagerModal.ts",
    "../src/features/capture/scheduled-item/ui/mobile/TimeboxManagerMobileScreen.ts",
]) {
    test(`${path} does not treat owner Focus Sessions as Timebox descendants`, async () => {
        const source = await readFile(new URL(path, import.meta.url), "utf8");
        assert.doesNotMatch(source, /ownerTimeboxId|scanFocusSessionsInBlock|this\.focusSessions/);
        assert.match(source, /hasFocusSessions: false/);
    });
}
