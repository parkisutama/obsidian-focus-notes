import assert from "node:assert/strict";
import test from "node:test";
import { TimelineLayout } from "../src/features/timeline/domain/TimelineLayout.ts";
import type { ScheduledItem } from "../src/features/capture/scheduled-item/domain/ScheduledItem.ts";

test("explicit all-day Events render in the all-day row instead of the hourly canvas", () => {
    const item: ScheduledItem = {
        id: "holiday",
        kind: "event",
        title: "Company holiday",
        start: new Date(2026, 7, 10),
        end: new Date(2026, 7, 11),
        due: null,
        dueHasTime: false,
        remind: null,
        priority: null,
        eventStatus: "planned",
        actualStart: null,
        actualEnd: null,
        allDay: true,
        isCompleted: false,
        source: {
            groupId: "daily-notes",
            groupName: "Daily Notes",
            filePath: "Daily/2026-08-10.md",
            fileName: "2026-08-10.md",
            lineNumber: 1,
            headingPath: ["Activities & Tasks"],
        },
        rawLine: "- 2026-08-10 Company holiday | type:event | all-day:true",
    };

    const layout = new TimelineLayout().build([item], {
        start: new Date(2026, 7, 10),
        end: new Date(2026, 7, 11),
    });

    assert.equal(layout.blocks.length, 0);
    assert.deepEqual(layout.dues, [{ itemId: "holiday", timeboxId: null, dayKey: "2026-08-10" }]);
});

function baseTaskItem(overrides: Partial<ScheduledItem>): ScheduledItem {
    return {
        id: "task-abc1234567",
        kind: "task",
        title: "Menyusun laporan",
        start: null,
        end: null,
        due: null,
        dueHasTime: false,
        remind: null,
        priority: null,
        eventStatus: null,
        actualStart: null,
        actualEnd: null,
        allDay: false,
        isCompleted: false,
        source: {
            groupId: "daily-notes",
            groupName: "Daily Notes",
            filePath: "Tasks/Report.md",
            fileName: "Report.md",
            lineNumber: 3,
            headingPath: [],
        },
        rawLine: "- [ ] Menyusun laporan ^task-abc1234567",
        ...overrides,
    };
}

test("two timeboxes on one Task keep distinct, stable segment identity by itemId plus timeboxId", () => {
    const items: ScheduledItem[] = [
        baseTaskItem({
            timeboxId: "timebox-aaaaaaaaaa",
            start: new Date(2026, 8, 1, 9, 0),
            end: new Date(2026, 8, 1, 10, 0),
        }),
        baseTaskItem({
            timeboxId: "timebox-bbbbbbbbbb",
            start: new Date(2026, 8, 1, 14, 0),
            end: new Date(2026, 8, 1, 15, 0),
        }),
    ];

    const layout = new TimelineLayout().build(items, {
        start: new Date(2026, 8, 1),
        end: new Date(2026, 8, 2),
    });

    assert.equal(layout.blocks.length, 2);
    const timeboxIds = layout.blocks.map((block) => block.timeboxId).sort();
    assert.deepEqual(timeboxIds, ["timebox-aaaaaaaaaa", "timebox-bbbbbbbbbb"]);
    assert.ok(layout.blocks.every((block) => block.itemId === "task-abc1234567"));
});

test("computes focus utilization for a timebox with logged actual sessions", () => {
    const item = baseTaskItem({
        timeboxId: "timebox-aaaaaaaaaa",
        start: new Date(2026, 8, 1, 9, 0),
        end: new Date(2026, 8, 1, 11, 0),
        focusSessions: [
            {
                sessionId: "focus-aaaaaaaaaa",
                start: new Date(2026, 8, 1, 9, 5),
                end: new Date(2026, 8, 1, 9, 30),
                durationSeconds: 1500,
                mode: "pomodoro",
            },
        ],
    });

    const layout = new TimelineLayout().build([item], {
        start: new Date(2026, 8, 1),
        end: new Date(2026, 8, 2),
    });

    assert.equal(layout.blocks.length, 1);
    assert.deepEqual(layout.blocks[0].utilization, {
        plannedSeconds: 7200,
        focusedSeconds: 1500,
        sessionCount: 1,
    });
});

test("reports zero-session utilization for a planned interval with no actual Focus Sessions yet", () => {
    const item = baseTaskItem({
        timeboxId: "timebox-aaaaaaaaaa",
        start: new Date(2026, 8, 1, 9, 0),
        end: new Date(2026, 8, 1, 11, 0),
    });

    const layout = new TimelineLayout().build([item], {
        start: new Date(2026, 8, 1),
        end: new Date(2026, 8, 2),
    });

    assert.deepEqual(layout.blocks[0].utilization, { plannedSeconds: 7200, focusedSeconds: 0, sessionCount: 0 });
});

test("lays out actual Focus Sessions as their own segments, independent of any planned Timebox", () => {
    const item = baseTaskItem({
        timeboxId: "timebox-aaaaaaaaaa",
        start: new Date(2026, 8, 1, 9, 0),
        end: new Date(2026, 8, 1, 10, 0),
        focusSessions: [
            {
                sessionId: "focus-aaaaaaaaaa",
                ownerItemId: "task-abc1234567",
                start: new Date(2026, 8, 1, 9, 5),
                end: new Date(2026, 8, 1, 9, 30),
                durationSeconds: 1500,
                mode: "pomodoro",
                stressLevel: null,
                emotionCategory: null,
                emotionKey: null,
                notes: null,
            },
            {
                sessionId: "focus-bbbbbbbbbb",
                ownerItemId: "task-abc1234567",
                start: new Date(2026, 8, 1, 14, 0),
                end: new Date(2026, 8, 1, 14, 20),
                durationSeconds: 1200,
                mode: "stopwatch",
                stressLevel: null,
                emotionCategory: null,
                emotionKey: null,
                notes: null,
            },
        ],
    });

    const layout = new TimelineLayout().build([item], {
        start: new Date(2026, 8, 1),
        end: new Date(2026, 8, 2),
    });

    assert.equal(layout.sessions.length, 2);
    const outsideBlock = layout.sessions.find((s) => s.sessionId === "focus-bbbbbbbbbb");
    assert.ok(outsideBlock, "a session outside the planned Timebox interval still lays out");
    assert.deepEqual(
        layout.sessions.map((s) => ({ sessionId: s.sessionId, itemId: s.itemId, mode: s.mode })).sort((a, b) => a.sessionId.localeCompare(b.sessionId)),
        [
            { sessionId: "focus-aaaaaaaaaa", itemId: "task-abc1234567", mode: "pomodoro" },
            { sessionId: "focus-bbbbbbbbbb", itemId: "task-abc1234567", mode: "stopwatch" },
        ],
    );
});

test("a cross-midnight Focus Session splits into per-day segments that all keep the same sessionId", () => {
    const item = baseTaskItem({
        focusSessions: [
            {
                sessionId: "focus-cccccccccc",
                ownerItemId: "task-abc1234567",
                start: new Date(2026, 8, 30, 22, 0),
                end: new Date(2026, 9, 1, 0, 30),
                durationSeconds: 9000,
                mode: "timer",
                stressLevel: null,
                emotionCategory: null,
                emotionKey: null,
                notes: null,
            },
        ],
    });

    const layout = new TimelineLayout().build([item], {
        start: new Date(2026, 8, 30),
        end: new Date(2026, 9, 2),
    });

    assert.equal(layout.sessions.length, 2);
    assert.deepEqual(
        layout.sessions.map((s) => ({ dayKey: s.dayKey, sessionId: s.sessionId })),
        [
            { dayKey: "2026-09-30", sessionId: "focus-cccccccccc" },
            { dayKey: "2026-10-01", sessionId: "focus-cccccccccc" },
        ],
    );
});

test("a cross-midnight timebox splits into per-day segments that all keep the same timeboxId", () => {
    const item = baseTaskItem({
        timeboxId: "timebox-cccccccccc",
        start: new Date(2026, 8, 30, 22, 0),
        end: new Date(2026, 9, 1, 6, 0),
    });

    const layout = new TimelineLayout().build([item], {
        start: new Date(2026, 8, 30),
        end: new Date(2026, 9, 2),
    });

    assert.equal(layout.blocks.length, 2);
    assert.deepEqual(
        layout.blocks.map((block) => ({ dayKey: block.dayKey, timeboxId: block.timeboxId, itemId: block.itemId })),
        [
            { dayKey: "2026-09-30", timeboxId: "timebox-cccccccccc", itemId: "task-abc1234567" },
            { dayKey: "2026-10-01", timeboxId: "timebox-cccccccccc", itemId: "task-abc1234567" },
        ],
    );
});
