import assert from "node:assert/strict";
import test from "node:test";
import type { ScheduledItem } from "../src/features/capture/scheduled-item/domain/ScheduledItem.ts";
import {
    buildPendingTaskModalModel,
    buildTimelineItemModalModel,
} from "../src/features/timeline/domain/TimelineItemModalModel.ts";

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
    eventStatus: "planned",
    actualStart: null,
    actualEnd: null,
    allDay: false,
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
    assert.equal(model.canEdit, true);
    assert.equal(model.editLabel, "Edit event");
    assert.equal(model.statusLabel, "Scheduled");
    assert.equal(model.actualScheduleLabel, null);
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
        eventStatus: null,
        isCompleted: true,
    };

    const model = buildTimelineItemModalModel(task);
    assert.equal(model.kindLabel, "Task");
    assert.equal(model.canEdit, true);
    assert.equal(model.editLabel, "Edit task");
    assert.equal(model.statusLabel, "Completed");
    assert.equal(model.priorityLabel, "High");
    assert.equal(model.scheduleLabel, "Due Aug 2, 2026");
});

test("Timeline Event details distinguish cancellation and completed actual time", () => {
    const cancelled = buildTimelineItemModalModel({ ...baseItem, eventStatus: "cancelled" });
    const completed = buildTimelineItemModalModel({
        ...baseItem,
        eventStatus: "completed",
        isCompleted: true,
        actualStart: new Date(2026, 7, 3, 9, 12),
        actualEnd: new Date(2026, 7, 3, 10, 18),
    });

    assert.equal(cancelled.statusLabel, "Cancelled");
    assert.equal(completed.statusLabel, "Completed");
    assert.equal(completed.actualScheduleLabel, "Aug 3, 2026 · 09:12–10:18");
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

test("presents a Task 61 focus summary with planned, focused, difference, percentage, and count", () => {
    const model = buildTimelineItemModalModel(baseItem, { plannedSeconds: 3600, focusedSeconds: 1800, sessionCount: 2 });
    assert.deepEqual(model.focusSummary, {
        plannedLabel: "60m",
        focusedLabel: "30m",
        differenceLabel: "-30m",
        percentageLabel: "50%",
        sessionCountLabel: "2 sessions",
    });
});

test("reports a positive difference and no percentage when nothing was planned", () => {
    const model = buildTimelineItemModalModel(baseItem, { plannedSeconds: 0, focusedSeconds: 900, sessionCount: 1 });
    assert.deepEqual(model.focusSummary, {
        plannedLabel: "0m",
        focusedLabel: "15m",
        differenceLabel: "+15m",
        percentageLabel: "—",
        sessionCountLabel: "1 session",
    });
});

test("omits the focus summary entirely when there is nothing planned or logged", () => {
    const model = buildTimelineItemModalModel(baseItem, { plannedSeconds: 0, focusedSeconds: 0, sessionCount: 0 });
    assert.equal(model.focusSummary, null);
    assert.equal(buildTimelineItemModalModel(baseItem, null).focusSummary, null);
});

test("labels the exact clicked segment as Planned or Focused, distinct from the owner aggregate", () => {
    const planned = buildTimelineItemModalModel(baseItem, null, {
        kind: "planned",
        start: new Date(2026, 7, 3, 9, 0),
        end: new Date(2026, 7, 3, 10, 0),
    });
    assert.match(planned.selectedSegmentLabel ?? "", /^Planned: /);

    const focused = buildTimelineItemModalModel(baseItem, null, {
        kind: "focused",
        start: new Date(2026, 7, 3, 9, 12),
        end: new Date(2026, 7, 3, 9, 37),
    });
    assert.match(focused.selectedSegmentLabel ?? "", /^Focused: /);

    assert.equal(buildTimelineItemModalModel(baseItem).selectedSegmentLabel, null);
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
