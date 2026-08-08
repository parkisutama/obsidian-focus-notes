import assert from "node:assert/strict";
import test from "node:test";
import { ScheduledItemQuery } from "../src/ScheduledItemQuery.ts";
import type { ScheduledItem, TaskPriority } from "../src/ScheduledItemTypes.ts";

function task(id: string, due: Date, priority: TaskPriority): ScheduledItem {
    return {
        id,
        kind: "task",
        title: id,
        start: null,
        end: null,
        due,
        dueHasTime: false,
        remind: null,
        priority,
        eventStatus: null,
        actualStart: null,
        actualEnd: null,
        allDay: false,
        isCompleted: false,
        source: {
            groupId: "daily-notes",
            groupName: "Daily Notes",
            filePath: `Daily/${id}.md`,
            fileName: `${id}.md`,
            lineNumber: 1,
            headingPath: ["Activities & Tasks"],
        },
        rawLine: `- [ ] ${id}`,
    };
}

test("pending Tasks sort by overdue anchor before priority and priority breaks date ties", () => {
    const query = new ScheduledItemQuery();
    const today = new Date(2026, 7, 10, 12, 0);
    const items = [
        task("low-old", new Date(2026, 7, 8), "low"),
        task("normal-recent", new Date(2026, 7, 9), "normal"),
        task("medium-old", new Date(2026, 7, 8), "medium"),
        task("high-old", new Date(2026, 7, 8), "high"),
    ];

    const pending = query.getPendingTasks(items, today, new Set(["daily-notes"]));

    assert.deepEqual(
        pending.map((item) => item.id),
        ["high-old", "medium-old", "low-old", "normal-recent"],
    );
});

test("completed and cancelled Events remain visible when completed Tasks are hidden", () => {
    const query = new ScheduledItemQuery();
    const completedEvent: ScheduledItem = {
        ...task("event", new Date(2026, 7, 8), "normal"),
        kind: "event",
        start: new Date(2026, 7, 8, 9, 0),
        end: new Date(2026, 7, 8, 10, 0),
        due: null,
        priority: null,
        eventStatus: "completed",
        isCompleted: true,
    };
    const cancelledEvent: ScheduledItem = {
        ...completedEvent,
        id: "cancelled",
        start: new Date(2026, 7, 8, 11, 0),
        end: new Date(2026, 7, 8, 12, 0),
        eventStatus: "cancelled",
        isCompleted: false,
    };
    const completedTask = { ...task("task", new Date(2026, 7, 8), "normal"), isCompleted: true };

    const visible = query.getItemsForRange(
        [completedEvent, cancelledEvent, completedTask],
        { start: new Date(2026, 7, 8), end: new Date(2026, 7, 9) },
        { visibleSources: new Set(["daily-notes"]), includeCompleted: false },
    );

    assert.deepEqual(
        visible.map((item) => item.id),
        ["event", "cancelled"],
    );
});
