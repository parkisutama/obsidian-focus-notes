import assert from "node:assert/strict";
import test from "node:test";
import { EventTaskFormState } from "../src/EventTaskFormState.ts";

test("builds the same default event record independently of a renderer", () => {
    const anchorDate = new Date(2026, 7, 1, 14, 30);
    const state = new EventTaskFormState(anchorDate, {
        file: "Daily/{{date}}.md",
        heading: "Schedule",
        position: "end",
        hubNotesFolder: "Hub",
        detailNotesFolder: "Details"
    });
    state.title = "  Project review  ";
    state.description = "Bring the draft";

    const record = state.buildRecord(null);

    assert.equal(record.kind, "event");
    assert.equal(record.title, "Project review");
    assert.equal(record.start.getTime(), new Date(2026, 7, 1, 14, 0).getTime());
    assert.equal(record.end.getTime(), new Date(2026, 7, 1, 15, 0).getTime());
    assert.equal(record.description, "Bring the draft");
    assert.equal(state.targetFile, "Daily/{{date}}.md");
});
test("builds task due, timebox, and reminders from shared form state", () => {
    const state = new EventTaskFormState(new Date(2026, 7, 1, 8, 0), {
        file: "Tasks.md",
        heading: "Tasks",
        position: "start",
        hubNotesFolder: "",
        detailNotesFolder: ""
    });
    state.kind = "task";
    state.title = "Ship mobile form";
    state.taskDueHasTime = true;
    state.taskDueTime = "10:15";
    state.taskTimeboxEnabled = true;
    state.taskTimeboxStartTime = "09:00";
    state.taskTimeboxEndTime = "10:00";
    state.reminders = [
        { date: "2026-08-01", time: "08:30" },
        { date: "", time: "09:00" }
    ];

    const record = state.buildRecord(null);

    assert.equal(record.kind, "task");
    assert.equal(record.due?.getTime(), new Date(2026, 7, 1, 10, 15).getTime());
    assert.equal(record.timebox?.start.getTime(), new Date(2026, 7, 1, 9, 0).getTime());
    assert.deepEqual(record.reminders.map(value => value.getTime()), [
        new Date(2026, 7, 1, 8, 30).getTime()
    ]);
});
