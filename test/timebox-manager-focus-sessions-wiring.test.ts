import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const desktopPath = "../src/features/capture/scheduled-item/ui/desktop/TimeboxManagerModal.ts";
const mobilePath = "../src/features/capture/scheduled-item/ui/mobile/TimeboxManagerMobileScreen.ts";

for (const path of [desktopPath, mobilePath]) {
    test(`${path} lists each timebox's actual Focus Sessions read-only (Task 44)`, async () => {
        const source = await readFile(new URL(path, import.meta.url), "utf8");
        assert.match(
            source,
            /import \{\s*type ScannedFocusSession,\s*scanFocusSessionsInBlock,\s*\} from "\.\.\/\.\.\/\.\.\/\.\.\/focus-session\/domain\/FocusSessionBlockScan\.ts";/,
        );
        assert.match(source, /this\.focusSessions = scanFocusSessionsInBlock\(this\.snapshot\.rawBlock\);/);
        assert.match(
            source,
            /const sessions = this\.focusSessions\.filter\(\(session\) => session\.ownerTimeboxId === timeboxId\);/,
        );
        assert.match(source, /cls: "fn-timebox-focus-sessions"/);
    });
}
