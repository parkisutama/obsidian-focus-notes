import assert from "node:assert/strict";
import test from "node:test";
import { ScheduledItemParser } from "../src/features/capture/scheduled-item/domain/ScheduledItemParser.ts";
import { editTaskLine, parseTaskLineEdit } from "../src/features/capture/scheduled-item/domain/TaskLineEditor.ts";
import type { SessionRecord } from "../src/features/focus-session/domain/SessionRecord.ts";

const source = {
    groupId: "daily-notes",
    groupName: "Daily Notes",
    filePath: "Daily/2026-08-30.md",
    fileName: "2026-08-30.md",
    lineNumber: 4,
    headingPath: ["Activities & Tasks"],
};

test("legacy Task keeps one cross-day timebox and its canonical block identity byte-identical", () => {
    const line =
        "- [ ] Prepare report | owner:Ana | start:2026-08-30 22:00 | end:2026-08-31 01:00" +
        " | remind:2026-08-30 21:45 ^task-legacytimebox";

    assert.deepEqual(parseTaskLineEdit(line), {
        status: "parsed",
        edit: {
            completed: false,
            priority: "normal",
            due: null,
            timebox: { start: "2026-08-30 22:00", end: "2026-08-31 01:00" },
            reminders: ["2026-08-30 21:45"],
        },
    });
    assert.deepEqual(
        editTaskLine(line, {
            completed: false,
            priority: "normal",
            due: null,
            timebox: { start: "2026-08-30 22:00", end: "2026-08-31 01:00" },
            reminders: ["2026-08-30 21:45"],
        }),
        { status: "ready", line },
    );
});

test("same-title Event and Task remain distinct canonical kinds through their stable block IDs", () => {
    const parser = new ScheduledItemParser();
    const event = parser.parseLine("- 2026-08-30 09:00 - 10:00 Prepare report ^event-canonical", source);
    const task = parser.parseLine("- [ ] Prepare report | due:2026-08-30 ^task-canonical", {
        ...source,
        lineNumber: 5,
    });

    assert.equal(event?.kind, "event");
    assert.equal(event?.id, "event-canonical");
    assert.equal(event?.blockId, "event-canonical");
    assert.equal(task?.kind, "task");
    assert.equal(task?.id, "task-canonical");
    assert.equal(task?.blockId, "task-canonical");
    assert.notEqual(event?.id, task?.id);
});

test("legacy Focus Session contract keeps free-text purpose without requiring owner identity", () => {
    const record: SessionRecord = {
        mode: "pomodoro",
        startTime: new Date(2026, 7, 30, 9, 0),
        endTime: new Date(2026, 7, 30, 9, 25),
        durationSeconds: 25 * 60,
        plannedSeconds: 25 * 60,
        task: "Prepare report",
        notes: "Drafted the conclusion",
        stressLevel: null,
        emotionCategory: null,
        moodKey: null,
        links: "[[Projects/Report]]",
    };

    assert.equal(record.task, "Prepare report");
    assert.equal(record.durationSeconds, 1500);
    assert.equal("ownerItemId" in record, false);
    assert.equal("timeboxId" in record, false);
});
