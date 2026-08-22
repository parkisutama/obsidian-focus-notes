import assert from "node:assert/strict";
import test from "node:test";
import { buildScheduledItemIdentityChange } from "../src/ScheduledItemIdentityMigration.ts";
import { ScheduledItemParser } from "../src/ScheduledItemParser.ts";

const source = {
    groupId: "active-note",
    groupName: "Active note",
    filePath: "Tasks.md",
    fileName: "Tasks.md",
    lineNumber: 2,
    headingPath: ["Activities & Tasks"],
};

test("proposes a previewable block-ID migration for legacy Tasks and Events", () => {
    const parser = new ScheduledItemParser();
    const task = parser.parseLine("- [ ] Review | due:2026-08-10", source);
    const event = parser.parseLine("- 2026-08-10 09:00 - 10:00 Review", { ...source, lineNumber: 3 });
    assert.ok(task);
    assert.ok(event);

    assert.deepEqual(buildScheduledItemIdentityChange(task, "fn-task-a1b2c3"), {
        lineNumber: 2,
        rawLine: "- [ ] Review | due:2026-08-10",
        normalizedLine: "- [ ] Review | due:2026-08-10 ^fn-task-a1b2c3",
    });
    assert.deepEqual(buildScheduledItemIdentityChange(event, "fn-event-d4e5f6"), {
        lineNumber: 3,
        rawLine: "- 2026-08-10 09:00 - 10:00 Review",
        normalizedLine: "- 2026-08-10 09:00 - 10:00 Review ^fn-event-d4e5f6",
    });
});

test("does not rewrite a record that already owns a block ID", () => {
    const item = new ScheduledItemParser().parseLine("- [ ] Review | due:2026-08-10 ^fn-task-existing", source);
    assert.ok(item);
    assert.equal(buildScheduledItemIdentityChange(item, "fn-task-unused"), null);
});
