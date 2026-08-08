import assert from "node:assert/strict";
import test from "node:test";
import type { ScheduledItem } from "../src/ScheduledItemTypes.ts";
import { buildPendingTaskModalModel, buildTimelineItemModalModel } from "../src/TimelineItemModalModel.ts";

const baseItem: ScheduledItem = {
    id: "daily-12",
    kind: "event",
    title: "Review proposal",
    start: new Date(2026, 7, 3, 9, 0),
    end: new Date(2026, 7, 3, 10, 30),
    due: null,
    dueHasTime: false,
    remind: null,
    priority: null,
    isCompleted: false,
    source: {
        groupId: "daily-notes",
        groupName: "Daily Notes",
        filePath: "Daily/2026-08-03.md",
        fileName: "2026-08-03.md",
        lineNumber: 12,
        headingPath: ["Activities & Tasks"],
    },
    rawLine: "- 2026-08-03 09:00 - 10:30 Review proposal",
};

test("Timeline item modal model presents an Event schedule and exact source", () => {
    const model = buildTimelineItemModalModel(baseItem);

    assert.equal(model.kindLabel, "Event");
    assert.equal(model.statusLabel, "Scheduled");
    assert.equal(model.scheduleLabel, "Aug 3, 2026 · 09:00–10:30");
    assert.equal(model.sourceLabel, "2026-08-03.md · Activities & Tasks · Line 12");
    assert.equal(model.sourcePath, "Daily/2026-08-03.md");
});

test("Timeline item modal model preserves completed and due-only Task semantics", () => {
    const task: ScheduledItem = {
        ...baseItem,
        kind: "task",
        title: "Submit invoice",
        start: null,
        end: null,
        due: new Date(2026, 7, 2),
        priority: "high",
        isCompleted: true,
    };

    const model = buildTimelineItemModalModel(task);
    assert.equal(model.kindLabel, "Task");
    assert.equal(model.statusLabel, "Completed");
    assert.equal(model.priorityLabel, "High");
    assert.equal(model.scheduleLabel, "Due Aug 2, 2026");
});

test("Timeline item modal model handles an item without schedule or heading metadata", () => {
    const item: ScheduledItem = {
        ...baseItem,
        start: null,
        end: null,
        source: { ...baseItem.source, headingPath: [] },
    };

    const model = buildTimelineItemModalModel(item);
    assert.equal(model.scheduleLabel, "No schedule");
    assert.equal(model.sourceLabel, "2026-08-03.md · Line 12");
    assert.equal(model.priorityLabel, null);
});

test("pending modal model reports varying dates and file depths without losing source identity", () => {
    const nestedTask: ScheduledItem = {
        ...baseItem,
        id: "nested-4",
        kind: "task",
        title: "Inspect block",
        start: null,
        end: null,
        due: new Date(2026, 7, 1),
        source: {
            filePath: "Persona/Work/Projects/G2/Activities/Inspection.md",
            fileName: "Inspection.md",
            lineNumber: 4,
            headingPath: [],
        },
    };

    const model = buildPendingTaskModalModel([nestedTask], new Date(2026, 7, 3));
    assert.equal(model.title, "Pending tasks");
    assert.equal(model.items[0]?.meta, "2 days ago · Aug 1, 2026 · Inspection.md");
    assert.equal(model.items[0]?.item.source.filePath, nestedTask.source.filePath);
});
