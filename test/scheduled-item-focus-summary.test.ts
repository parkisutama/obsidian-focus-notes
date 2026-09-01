import assert from "node:assert/strict";
import test from "node:test";
import {
    formatScheduledItemFocusSummary,
    summarizeScheduledItemFocus,
    summarizeScheduledItemFocusFromItems,
} from "../src/features/capture/scheduled-item/domain/ScheduledItemFocusSummary.ts";
import type { ScheduledItem } from "../src/features/capture/scheduled-item/domain/ScheduledItem.ts";

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

test("sums every non-cancelled Task Timebox as planned time, excluding cancelled ones", () => {
    const summary = summarizeScheduledItemFocus(
        { kind: "task", start: null, end: null, allDay: false },
        [
            { start: new Date(2026, 8, 1, 9, 0), end: new Date(2026, 8, 1, 10, 0), status: "planned" },
            { start: new Date(2026, 8, 2, 9, 0), end: new Date(2026, 8, 2, 9, 30), status: "completed" },
            { start: new Date(2026, 8, 3, 9, 0), end: new Date(2026, 8, 3, 11, 0), status: "cancelled" },
        ],
        [],
    );
    assert.deepEqual(summary, { plannedSeconds: 3600 + 1800, focusedSeconds: 0, sessionCount: 0 });
});

test("uses an Event's own interval as planned time and zero for all-day", () => {
    const scheduled = summarizeScheduledItemFocus(
        { kind: "event", start: new Date(2026, 8, 1, 9, 0), end: new Date(2026, 8, 1, 12, 0), allDay: false },
        [],
        [],
    );
    assert.equal(scheduled.plannedSeconds, 3 * 3600);

    const allDay = summarizeScheduledItemFocus(
        { kind: "event", start: new Date(2026, 8, 1), end: new Date(2026, 8, 1), allDay: true },
        [],
        [],
    );
    assert.equal(allDay.plannedSeconds, 0);
});

test("counts multiple Focus Sessions and sessions outside the planned interval without pairing", () => {
    const summary = summarizeScheduledItemFocus(
        { kind: "task", start: null, end: null, allDay: false },
        [{ start: new Date(2026, 8, 1, 9, 0), end: new Date(2026, 8, 1, 10, 0), status: "planned" }],
        [{ durationSeconds: 600 }, { durationSeconds: 1500 }, { durationSeconds: 300 }],
    );
    assert.deepEqual(summary, { plannedSeconds: 3600, focusedSeconds: 2400, sessionCount: 3 });
});

test("reports logged focus time for a Task with zero planned time", () => {
    const noTimeboxes = summarizeScheduledItemFocus(
        { kind: "task", start: null, end: null, allDay: false },
        [],
        [{ durationSeconds: 900 }],
    );
    assert.deepEqual(noTimeboxes, { plannedSeconds: 0, focusedSeconds: 900, sessionCount: 1 });

    const onlyCancelled = summarizeScheduledItemFocus(
        { kind: "task", start: null, end: null, allDay: false },
        [{ start: new Date(2026, 8, 1, 9, 0), end: new Date(2026, 8, 1, 10, 0), status: "cancelled" }],
        [{ durationSeconds: 900 }],
    );
    assert.deepEqual(onlyCancelled, { plannedSeconds: 0, focusedSeconds: 900, sessionCount: 1 });
});

test("gathers a Task's owner-level summary from the indexed item list, excluding a cancelled sibling Timebox", () => {
    const items: ScheduledItem[] = [
        baseTaskItem({
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
            ],
        }),
        baseTaskItem({
            timeboxId: "timebox-aaaaaaaaaa",
            timeboxStatus: "planned",
            start: new Date(2026, 8, 1, 9, 0),
            end: new Date(2026, 8, 1, 10, 0),
        }),
        baseTaskItem({
            timeboxId: "timebox-bbbbbbbbbb",
            timeboxStatus: "cancelled",
            start: new Date(2026, 8, 2, 9, 0),
            end: new Date(2026, 8, 2, 11, 0),
        }),
    ];

    assert.deepEqual(summarizeScheduledItemFocusFromItems(items, "task-abc1234567"), {
        plannedSeconds: 3600,
        focusedSeconds: 1500,
        sessionCount: 1,
    });
    assert.equal(summarizeScheduledItemFocusFromItems(items, "task-missing"), null);
});

test("Task 64: formats the same shared summary Timeline and Manage both present", () => {
    assert.deepEqual(
        formatScheduledItemFocusSummary({ plannedSeconds: 3600, focusedSeconds: 1800, sessionCount: 2 }),
        {
            plannedLabel: "60m",
            focusedLabel: "30m",
            differenceLabel: "-30m",
            percentageLabel: "50%",
            sessionCountLabel: "2 sessions",
        },
    );
    assert.equal(formatScheduledItemFocusSummary({ plannedSeconds: 0, focusedSeconds: 0, sessionCount: 0 }), null);
});
