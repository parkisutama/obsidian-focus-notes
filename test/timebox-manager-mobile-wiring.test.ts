import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Planning uses one responsive modal entry point on desktop and mobile so navigation and
// persistence semantics do not drift between the two layouts.

test("mobile Edit screen opens the Timebox Manager for Task kind only, independent of desktop UI", async () => {
    const [editScreen, planningEntry, manager] = await Promise.all([
        readFile(
            new URL(
                "../src/features/capture/scheduled-item/ui/mobile/ScheduledItemMobileEditScreen.ts",
                import.meta.url,
            ),
            "utf8",
        ),
        readFile(new URL("../src/features/capture/scheduled-item/ui/PlanningManagerModal.ts", import.meta.url), "utf8"),
        readFile(
            new URL("../src/features/capture/scheduled-item/ui/desktop/TimeboxManagerModal.ts", import.meta.url),
            "utf8",
        ),
    ]);
    assert.match(editScreen, /import { PlanningManagerModal } from "\.\.\/PlanningManagerModal\.ts";/);
    assert.match(
        editScreen,
        /onManageTimeboxes: this\.data\.kind === "task" \? \(\) => this\.openTimeboxManager\(\) : undefined/,
    );
    assert.match(editScreen, /new PlanningManagerModal\(/);
    assert.match(planningEntry, /TimeboxManagerModal as PlanningManagerModal/);
    assert.match(manager, /renderReminders/);
    assert.match(manager, /addTaskTimebox/);
    assert.match(manager, /editTaskTimebox/);
    assert.match(manager, /setTaskTimeboxStatus/);
    assert.match(manager, /deleteTaskTimebox/);
    assert.match(manager, /runTaskDayProjection/);
});
