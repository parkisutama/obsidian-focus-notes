import assert from "node:assert/strict";
import test from "node:test";
import {
    addTaskTimebox,
    cancelPlannedTimeboxesForTaskCompletion,
    deleteTaskTimebox,
    editTaskTimebox,
    setTaskTimeboxStatus,
} from "../src/features/capture/scheduled-item/application/TaskTimeboxOperations.ts";
import type { TaskTimebox } from "../src/features/capture/scheduled-item/domain/TaskTimebox.ts";

const noDue = { due: null };
const planned = (id: string, start: string, end: string, status: TaskTimebox["status"] = "planned"): TaskTimebox => ({
    timeboxId: id,
    start,
    end,
    status,
});

test("adds a planned timebox with a fresh id and no warnings when nothing conflicts", () => {
    const result = addTaskTimebox(
        [],
        { start: "2026-08-31 09:00", end: "2026-08-31 11:00" },
        noDue,
        () => "timebox-newid",
    );
    assert.deepEqual(result, {
        status: "added",
        timeboxes: [
            { timeboxId: "timebox-newid", start: "2026-08-31 09:00", end: "2026-08-31 11:00", status: "planned" },
        ],
        timebox: { timeboxId: "timebox-newid", start: "2026-08-31 09:00", end: "2026-08-31 11:00", status: "planned" },
        warnings: [],
    });
});

test("rejects an end-before-start interval on add", () => {
    assert.deepEqual(addTaskTimebox([], { start: "2026-08-31 11:00", end: "2026-08-31 09:00" }, noDue), {
        status: "invalid",
        reason: "invalid-interval",
    });
});

test("rejects an end-equal-to-start interval on add", () => {
    assert.deepEqual(addTaskTimebox([], { start: "2026-08-31 09:00", end: "2026-08-31 09:00" }, noDue), {
        status: "invalid",
        reason: "invalid-interval",
    });
});

test("warns, but does not block, on same-Task overlap", () => {
    const existing = [planned("timebox-a", "2026-08-31 09:00", "2026-08-31 11:00")];
    const result = addTaskTimebox(
        existing,
        { start: "2026-08-31 10:00", end: "2026-08-31 12:00" },
        noDue,
        () => "timebox-b",
    );
    assert.equal(result.status, "added");
    if (result.status !== "added") return;
    assert.deepEqual(result.warnings, [{ type: "overlap", withTimeboxId: "timebox-a" }]);
    assert.equal(result.timeboxes.length, 2);
});

test("does not warn about overlap against a cancelled timebox", () => {
    const existing = [planned("timebox-a", "2026-08-31 09:00", "2026-08-31 11:00", "cancelled")];
    const result = addTaskTimebox(existing, { start: "2026-08-31 10:00", end: "2026-08-31 12:00" }, noDue);
    assert.equal(result.status, "added");
    if (result.status !== "added") return;
    assert.deepEqual(result.warnings, []);
});

test("warns when scheduling after a timed due date", () => {
    const due = { due: { date: "2026-08-30 18:00", hasTime: true } };
    const result = addTaskTimebox([], { start: "2026-08-31 09:00", end: "2026-08-31 10:00" }, due);
    assert.equal(result.status, "added");
    if (result.status !== "added") return;
    assert.deepEqual(result.warnings, [{ type: "after-due", due: "2026-08-30 18:00" }]);
});

test("does not warn when scheduled on the same calendar day as a date-only due date", () => {
    const due = { due: { date: "2026-08-31", hasTime: false } };
    const result = addTaskTimebox([], { start: "2026-08-31 09:00", end: "2026-08-31 10:00" }, due);
    assert.equal(result.status, "added");
    if (result.status !== "added") return;
    assert.deepEqual(result.warnings, []);
});

test("edits an existing timebox's interval while preserving its timeboxId", () => {
    const existing = [planned("timebox-a", "2026-08-31 09:00", "2026-08-31 11:00")];
    const result = editTaskTimebox(
        existing,
        "timebox-a",
        { start: "2026-08-31 10:00", end: "2026-08-31 12:00" },
        noDue,
    );
    assert.deepEqual(result, {
        status: "edited",
        timeboxes: [{ timeboxId: "timebox-a", start: "2026-08-31 10:00", end: "2026-08-31 12:00", status: "planned" }],
        warnings: [],
    });
});

test("rejects editing to an invalid interval", () => {
    const existing = [planned("timebox-a", "2026-08-31 09:00", "2026-08-31 11:00")];
    assert.deepEqual(
        editTaskTimebox(existing, "timebox-a", { start: "2026-08-31 12:00", end: "2026-08-31 09:00" }, noDue),
        { status: "invalid", reason: "invalid-interval" },
    );
});

test("editing an unknown timebox id reports not-found", () => {
    assert.deepEqual(
        editTaskTimebox([], "timebox-missing", { start: "2026-08-31 09:00", end: "2026-08-31 10:00" }, noDue),
        { status: "not-found" },
    );
});

test("sets a timebox's status by id", () => {
    const existing = [planned("timebox-a", "2026-08-31 09:00", "2026-08-31 11:00")];
    assert.deepEqual(setTaskTimeboxStatus(existing, "timebox-a", "completed"), {
        status: "updated",
        timeboxes: [planned("timebox-a", "2026-08-31 09:00", "2026-08-31 11:00", "completed")],
    });
});

test("setting status on an unknown timebox id reports not-found", () => {
    assert.deepEqual(setTaskTimeboxStatus([], "timebox-missing", "skipped"), { status: "not-found" });
});

test("deletes a planned timebox without requiring confirmation", () => {
    const existing = [planned("timebox-a", "2026-08-31 09:00", "2026-08-31 11:00")];
    assert.deepEqual(deleteTaskTimebox(existing, "timebox-a"), { status: "deleted", timeboxes: [] });
});

test("deleting a historical timebox requires explicit confirmation", () => {
    const existing = [planned("timebox-a", "2026-08-31 09:00", "2026-08-31 11:00", "completed")];
    assert.deepEqual(deleteTaskTimebox(existing, "timebox-a"), { status: "requires-confirmation" });
    assert.deepEqual(deleteTaskTimebox(existing, "timebox-a", { confirmedHistorical: true }), {
        status: "deleted",
        timeboxes: [],
    });
});

test("deleting a planned timebox that already has logged Focus Sessions also requires confirmation", () => {
    const existing = [planned("timebox-a", "2026-08-31 09:00", "2026-08-31 11:00")];
    assert.deepEqual(deleteTaskTimebox(existing, "timebox-a", { hasFocusSessions: true }), {
        status: "requires-confirmation",
    });
    assert.deepEqual(deleteTaskTimebox(existing, "timebox-a", { hasFocusSessions: true, confirmedHistorical: true }), {
        status: "deleted",
        timeboxes: [],
    });
});

test("deleting an unknown timebox id reports not-found", () => {
    assert.deepEqual(deleteTaskTimebox([], "timebox-missing"), { status: "not-found" });
});

test("completing a Task cancels every planned timebox but preserves historical ones", () => {
    const existing = [
        planned("timebox-a", "2026-08-31 09:00", "2026-08-31 11:00", "planned"),
        planned("timebox-b", "2026-08-30 09:00", "2026-08-30 11:00", "completed"),
        planned("timebox-c", "2026-08-29 09:00", "2026-08-29 11:00", "skipped"),
        planned("timebox-d", "2026-08-28 09:00", "2026-08-28 11:00", "cancelled"),
    ];
    assert.deepEqual(cancelPlannedTimeboxesForTaskCompletion(existing), [
        planned("timebox-a", "2026-08-31 09:00", "2026-08-31 11:00", "cancelled"),
        planned("timebox-b", "2026-08-30 09:00", "2026-08-30 11:00", "completed"),
        planned("timebox-c", "2026-08-29 09:00", "2026-08-29 11:00", "skipped"),
        planned("timebox-d", "2026-08-28 09:00", "2026-08-28 11:00", "cancelled"),
    ]);
});
