import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("clicking a Timeline segment for a Task timebox opens the Timebox Manager with that occurrence selected", async () => {
    const source = await readFile(
        new URL("../src/features/capture/ui/ScheduledItemEditor.ts", import.meta.url),
        "utf8",
    );
    assert.match(
        source,
        /import { TimeboxManagerModal } from "\.\.\/scheduled-item\/ui\/desktop\/TimeboxManagerModal\.ts";/,
    );
    assert.match(
        source,
        /import { TimeboxManagerMobileScreen } from "\.\.\/scheduled-item\/ui\/mobile\/TimeboxManagerMobileScreen\.ts";/,
    );
    assert.match(
        source,
        /if \(item\.timeboxId\) \{\s*openTimeboxManager\(app, getSettings, captured\.snapshot, item, onComplete\);/,
    );
    assert.match(source, /selectedTimeboxId: item\.timeboxId/);
});
