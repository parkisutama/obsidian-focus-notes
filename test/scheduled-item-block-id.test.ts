import assert from "node:assert/strict";
import test from "node:test";
import {
    appendScheduledItemBlockId,
    createScheduledItemBlockId,
    extractScheduledItemBlockId,
    formatScheduledItemBlockTarget,
} from "../src/ScheduledItemBlockId.ts";
import { ScheduledItemParser } from "../src/ScheduledItemParser.ts";

const source = {
    groupId: "daily-notes",
    groupName: "Daily Notes",
    filePath: "Daily/2026-08-10.md",
    fileName: "2026-08-10.md",
    lineNumber: 4,
    headingPath: ["Activities & Tasks"],
};

test("extracts only a trailing Obsidian block ID from a scheduled item line", () => {
    assert.deepEqual(extractScheduledItemBlockId("- [ ] Review | due:2026-08-10 ^fn-task-a1b2c3"), {
        semanticLine: "- [ ] Review | due:2026-08-10",
        blockId: "fn-task-a1b2c3",
    });
    assert.deepEqual(extractScheduledItemBlockId("- [ ] Review ^inside the title | due:2026-08-10"), {
        semanticLine: "- [ ] Review ^inside the title | due:2026-08-10",
        blockId: null,
    });
});

test("appends an ID once and formats a native Obsidian block target", () => {
    assert.equal(
        appendScheduledItemBlockId("- [ ] Review | due:2026-08-10", "fn-task-a1b2c3"),
        "- [ ] Review | due:2026-08-10 ^fn-task-a1b2c3",
    );
    assert.equal(
        appendScheduledItemBlockId("- [ ] Review ^fn-task-existing", "fn-task-replacement"),
        "- [ ] Review ^fn-task-existing",
    );
    assert.equal(formatScheduledItemBlockTarget("Tasks/Work.md", "fn-task-a1b2c3"), "Tasks/Work.md#^fn-task-a1b2c3");
});

test("generates concise kind-prefixed IDs with 50 bits of Base32 entropy", () => {
    const taskIds = Array.from({ length: 100 }, () => createScheduledItemBlockId("task"));
    const eventId = createScheduledItemBlockId("event");

    assert.ok(taskIds.every((id) => /^task-[0123456789abcdefghjkmnpqrstvwxyz]{10}$/.test(id)));
    assert.match(eventId, /^event-[0123456789abcdefghjkmnpqrstvwxyz]{10}$/);
    assert.equal(new Set(taskIds).size, taskIds.length);
});

test("parser keeps final metadata valid and uses the block ID as stable identity", () => {
    const task = new ScheduledItemParser().parseLine("- [ ] Review | due:2026-08-10 ^fn-task-a1b2c3", source);
    const event = new ScheduledItemParser().parseLine(
        "- 2026-08-10 09:00 - 10:00 Review | status:completed ^fn-event-d4e5f6",
        source,
    );

    assert.equal(task?.due?.getTime(), new Date(2026, 7, 10).getTime());
    assert.equal(task?.blockId, "fn-task-a1b2c3");
    assert.equal(task?.id, "fn-task-a1b2c3");
    assert.equal(event?.eventStatus, "completed");
    assert.equal(event?.blockId, "fn-event-d4e5f6");
    assert.equal(event?.id, "fn-event-d4e5f6");
});
