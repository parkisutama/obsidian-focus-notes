import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// TimeboxManagerModal extends Obsidian's Modal and can't be instantiated in node:test (see
// mobile-scheduled-item-create-composition.test.ts for the established pattern), so this
// characterizes that the Edit Task modal actually offers the entry point the spec requires.

test("Edit Task modal opens the Timebox Manager for Task kind only", async () => {
    const source = await readFile(
        new URL("../src/features/capture/scheduled-item/ui/desktop/ScheduledItemDesktopEditModal.ts", import.meta.url),
        "utf8",
    );
    assert.match(source, /import { TimeboxManagerModal } from "\.\/TimeboxManagerModal\.ts";/);
    assert.match(
        source,
        /onManageTimeboxes: this\.data\.kind === "task" \? \(\) => this\.openTimeboxManager\(\) : undefined/,
    );
    assert.match(
        source,
        /new TimeboxManagerModal\(\s*this\.app,\s*this\.getSettings,\s*\{ snapshot: this\.snapshot, title, completed, due \},\s*onComplete,\s*\)\.open\(\);/,
    );
});

test("the Timebox Manager modal is built on the Task 34 service and canonical block parser", async () => {
    const source = await readFile(
        new URL("../src/features/capture/scheduled-item/ui/desktop/TimeboxManagerModal.ts", import.meta.url),
        "utf8",
    );
    assert.match(source, /addTaskTimebox/);
    assert.match(source, /editTaskTimebox/);
    assert.match(source, /setTaskTimeboxStatus/);
    assert.match(source, /deleteTaskTimebox/);
    assert.match(source, /parseScheduledItemBlock/);
    assert.match(source, /saveScheduledItemBlock/);
    assert.match(source, /runTaskDayProjection/);
});
