import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const desktopPath = "../src/features/capture/scheduled-item/ui/desktop/TimeboxManagerModal.ts";
const mobilePath = "../src/features/capture/scheduled-item/ui/mobile/TimeboxManagerMobileScreen.ts";

for (const path of [desktopPath, mobilePath]) {
    test(`${path} requires confirmation before deleting a timebox with logged Focus Sessions (Task 46)`, async () => {
        const source = await readFile(new URL(path, import.meta.url), "utf8");
        assert.match(
            source,
            /const hasFocusSessions = this\.focusSessions\.some\(\(session\) => session\.ownerTimeboxId === timeboxId\);/,
        );
        assert.match(source, /if \(timebox\.status === "planned" && !hasFocusSessions\)/);
        assert.match(
            source,
            /deleteTaskTimebox\(this\.timeboxes, timeboxId, \{ confirmedHistorical, hasFocusSessions \}\)/,
        );
    });
}
