import assert from "node:assert/strict";
import test from "node:test";
import {
    diffTaskDayReferences,
    planTaskDayReferences,
} from "../src/features/capture/scheduled-item/domain/TaskDayReferencePlan.ts";

test("a Task with neither due date nor timebox plans no references", () => {
    assert.deepEqual(planTaskDayReferences(null, []), []);
});

test("a due-only Task plans exactly one due reference", () => {
    assert.deepEqual(planTaskDayReferences("2026-09-03", []), [{ date: "2026-09-03", due: true, timeboxId: null }]);
});

test("a timebox-only Task plans one reference per touched day, without the due role", () => {
    const timeboxes = [{ timeboxId: "timebox-a", start: new Date(2026, 8, 1, 9, 0), end: new Date(2026, 8, 1, 11, 0) }];
    assert.deepEqual(planTaskDayReferences(null, timeboxes), [
        { date: "2026-09-01", due: false, timeboxId: "timebox-a" },
    ]);
});

test("a cross-day timebox plans one reference per day it touches", () => {
    const timeboxes = [
        { timeboxId: "timebox-a", start: new Date(2026, 8, 30, 22, 0), end: new Date(2026, 9, 1, 6, 0) },
    ];
    assert.deepEqual(planTaskDayReferences(null, timeboxes), [
        { date: "2026-09-30", due: false, timeboxId: "timebox-a" },
        { date: "2026-10-01", due: false, timeboxId: "timebox-a" },
    ]);
});

test("due and a timebox on the same day merge into one reference carrying both roles", () => {
    const timeboxes = [{ timeboxId: "timebox-a", start: new Date(2026, 8, 3, 9, 0), end: new Date(2026, 8, 3, 11, 0) }];
    assert.deepEqual(planTaskDayReferences("2026-09-03", timeboxes), [
        { date: "2026-09-03", due: true, timeboxId: "timebox-a" },
    ]);
});

test("due on a different day than any timebox plans a separate due reference", () => {
    const timeboxes = [{ timeboxId: "timebox-a", start: new Date(2026, 8, 1, 9, 0), end: new Date(2026, 8, 1, 11, 0) }];
    assert.deepEqual(planTaskDayReferences("2026-09-05", timeboxes), [
        { date: "2026-09-01", due: false, timeboxId: "timebox-a" },
        { date: "2026-09-05", due: true, timeboxId: null },
    ]);
});

test("multiple timeboxes on the same day each keep their own reference", () => {
    const timeboxes = [
        { timeboxId: "timebox-a", start: new Date(2026, 8, 1, 9, 0), end: new Date(2026, 8, 1, 10, 0) },
        { timeboxId: "timebox-b", start: new Date(2026, 8, 1, 14, 0), end: new Date(2026, 8, 1, 15, 0) },
    ];
    assert.deepEqual(planTaskDayReferences(null, timeboxes), [
        { date: "2026-09-01", due: false, timeboxId: "timebox-a" },
        { date: "2026-09-01", due: false, timeboxId: "timebox-b" },
    ]);
});

test("due merges into only the first same-day timebox when several share that day", () => {
    const timeboxes = [
        { timeboxId: "timebox-a", start: new Date(2026, 8, 1, 9, 0), end: new Date(2026, 8, 1, 10, 0) },
        { timeboxId: "timebox-b", start: new Date(2026, 8, 1, 14, 0), end: new Date(2026, 8, 1, 15, 0) },
    ];
    assert.deepEqual(planTaskDayReferences("2026-09-01", timeboxes), [
        { date: "2026-09-01", due: true, timeboxId: "timebox-a" },
        { date: "2026-09-01", due: false, timeboxId: "timebox-b" },
    ]);
});

test("diffing identical plans creates and removes nothing", () => {
    const plan = [{ date: "2026-09-01", due: false, timeboxId: "timebox-a" }];
    assert.deepEqual(diffTaskDayReferences(plan, plan), { toCreate: [], toRemove: [] });
});

test("diffing plans only creates newly touched days and removes dropped ones", () => {
    const previous = [
        { date: "2026-09-01", due: false, timeboxId: "timebox-a" },
        { date: "2026-09-02", due: false, timeboxId: "timebox-a" },
    ];
    const next = [
        { date: "2026-09-01", due: false, timeboxId: "timebox-a" },
        { date: "2026-09-03", due: false, timeboxId: "timebox-a" },
    ];
    assert.deepEqual(diffTaskDayReferences(previous, next), {
        toCreate: [{ date: "2026-09-03", due: false, timeboxId: "timebox-a" }],
        toRemove: [{ date: "2026-09-02", due: false, timeboxId: "timebox-a" }],
    });
});

test("diffing replaces an entry whose due role changed even though its (day, timebox) key is unchanged", () => {
    const previous = [{ date: "2026-09-01", due: false, timeboxId: "timebox-a" }];
    const next = [{ date: "2026-09-01", due: true, timeboxId: "timebox-a" }];
    assert.deepEqual(diffTaskDayReferences(previous, next), {
        toCreate: [{ date: "2026-09-01", due: true, timeboxId: "timebox-a" }],
        toRemove: [{ date: "2026-09-01", due: false, timeboxId: "timebox-a" }],
    });
});
