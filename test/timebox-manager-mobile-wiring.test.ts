import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// TimeboxManagerMobileScreen extends Obsidian's Component and can't be instantiated in
// node:test (see mobile-scheduled-item-create-composition.test.ts for the established pattern),
// so this characterizes that the mobile Edit screen offers the same entry point as desktop.

test("mobile Edit screen opens the Timebox Manager for Task kind only, independent of desktop UI", async () => {
    const [editScreen, mobileScreen] = await Promise.all([
        readFile(
            new URL(
                "../src/features/capture/scheduled-item/ui/mobile/ScheduledItemMobileEditScreen.ts",
                import.meta.url,
            ),
            "utf8",
        ),
        readFile(
            new URL("../src/features/capture/scheduled-item/ui/mobile/TimeboxManagerMobileScreen.ts", import.meta.url),
            "utf8",
        ),
    ]);
    assert.match(editScreen, /import { TimeboxManagerMobileScreen } from "\.\/TimeboxManagerMobileScreen\.ts";/);
    assert.match(
        editScreen,
        /onManageTimeboxes: this\.data\.kind === "task" \? \(\) => this\.openTimeboxManager\(\) : undefined/,
    );
    assert.match(
        editScreen,
        /new TimeboxManagerMobileScreen\(\s*this\.app,\s*this\.getSettings,\s*\{ snapshot: this\.snapshot, title, completed, due \},\s*onComplete,\s*\)\.open\(\);/,
    );
    assert.doesNotMatch(mobileScreen, /desktop/i);
    assert.match(mobileScreen, /addTaskTimebox/);
    assert.match(mobileScreen, /editTaskTimebox/);
    assert.match(mobileScreen, /setTaskTimeboxStatus/);
    assert.match(mobileScreen, /deleteTaskTimebox/);
    assert.match(mobileScreen, /runTaskDayProjection/);
});
