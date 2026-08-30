import assert from "node:assert/strict";
import test from "node:test";
import {
    type TaskDayProjectionResult,
    projectTaskDays,
    retryTaskDayProjection,
} from "../src/features/capture/scheduled-item/application/TaskDayProjection.ts";

const baseInput = {
    title: "Menyusun laporan",
    completed: false,
    canonicalFilePath: "Projects/Report.md",
    canonicalBlockId: "task-def4567890",
    heading: "Activities & Tasks",
    position: "end" as const,
};

function dependencies(overrides: Partial<Parameters<typeof projectTaskDays>[2]> = {}) {
    let counter = 0;
    return {
        resolveDayFile: (dayKey: string) => `Daily/${dayKey}.md`,
        writeReference: async () => undefined,
        removeReference: async () => undefined,
        createReferenceBlockId: () => `task-ref-mock${String(counter++).padStart(4, "0")}`,
        ...overrides,
    };
}

test("a Task with neither due nor timebox writes no references", async () => {
    const writes: string[] = [];
    const result = await projectTaskDays({ ...baseInput, dueDayKey: null, timeboxes: [] }, [], {
        ...dependencies(),
        writeReference: async (r) => void writes.push(r.destinationPath),
    });
    assert.deepEqual(result, { status: "success", plan: [] });
    assert.deepEqual(writes, []);
});

test("a due-only Task writes exactly one due reference", async () => {
    const writes: string[] = [];
    const result = await projectTaskDays({ ...baseInput, dueDayKey: "2026-09-03", timeboxes: [] }, [], {
        ...dependencies(),
        writeReference: async (r) => void writes.push(r.destinationPath),
    });
    assert.equal(result.status, "success");
    assert.deepEqual(writes, ["Daily/2026-09-03.md"]);
});

test("adding a new timebox only creates a reference for the newly touched day", async () => {
    const created: string[] = [];
    const previousPlan = [{ date: "2026-09-01", due: false, timeboxId: "timebox-a" }];
    const input = {
        ...baseInput,
        dueDayKey: null,
        timeboxes: [
            { timeboxId: "timebox-a", start: new Date(2026, 8, 1, 9, 0), end: new Date(2026, 8, 1, 10, 0) },
            { timeboxId: "timebox-b", start: new Date(2026, 8, 2, 9, 0), end: new Date(2026, 8, 2, 10, 0) },
        ],
    };
    const result = await projectTaskDays(input, previousPlan, {
        ...dependencies(),
        writeReference: async (r) => void created.push(r.destinationPath),
    });
    assert.equal(result.status, "success");
    assert.deepEqual(created, ["Daily/2026-09-02.md"]);
});

test("removing a timebox removes only its day reference", async () => {
    const removed: { destinationPath: string; timeboxId?: string | null }[] = [];
    const previousPlan = [
        { date: "2026-09-01", due: false, timeboxId: "timebox-a" },
        { date: "2026-09-02", due: false, timeboxId: "timebox-b" },
    ];
    const input = {
        ...baseInput,
        dueDayKey: null,
        timeboxes: [{ timeboxId: "timebox-a", start: new Date(2026, 8, 1, 9, 0), end: new Date(2026, 8, 1, 10, 0) }],
    };
    const result = await projectTaskDays(input, previousPlan, {
        ...dependencies(),
        removeReference: async (r) => void removed.push({ destinationPath: r.destinationPath, timeboxId: r.timeboxId }),
    });
    assert.equal(result.status, "success");
    assert.deepEqual(removed, [{ destinationPath: "Daily/2026-09-02.md", timeboxId: "timebox-b" }]);
});

test("two timeboxes on the same day both get removed independently, not deduplicated by file", async () => {
    const removed: (string | null | undefined)[] = [];
    const previousPlan = [
        { date: "2026-09-01", due: false, timeboxId: "timebox-a" },
        { date: "2026-09-01", due: false, timeboxId: "timebox-b" },
    ];
    const result = await projectTaskDays({ ...baseInput, dueDayKey: null, timeboxes: [] }, previousPlan, {
        ...dependencies(),
        removeReference: async (r) => void removed.push(r.timeboxId),
    });
    assert.equal(result.status, "success");
    assert.deepEqual(removed, ["timebox-a", "timebox-b"]);
});

test("a completion-state flip rewrites every existing reference instead of leaving stale checkboxes", async () => {
    const removed: string[] = [];
    const created: string[] = [];
    const previousPlan = [
        { date: "2026-09-03", due: true, timeboxId: null },
        { date: "2026-09-01", due: false, timeboxId: "timebox-a" },
    ];
    const input = {
        ...baseInput,
        completed: true,
        dueDayKey: "2026-09-03",
        timeboxes: [{ timeboxId: "timebox-a", start: new Date(2026, 8, 1, 9, 0), end: new Date(2026, 8, 1, 10, 0) }],
    };
    const result = await projectTaskDays(
        input,
        previousPlan,
        {
            ...dependencies(),
            writeReference: async (r) => void created.push(r.destinationPath),
            removeReference: async (r) => void removed.push(r.destinationPath),
        },
        false,
    );
    assert.equal(result.status, "success");
    assert.deepEqual(created.sort(), ["Daily/2026-09-01.md", "Daily/2026-09-03.md"]);
    assert.deepEqual(removed.sort(), ["Daily/2026-09-01.md", "Daily/2026-09-03.md"]);
});

test("an unchanged completion state still only rewrites the days that actually changed", async () => {
    const removed: string[] = [];
    const created: string[] = [];
    const previousPlan = [{ date: "2026-09-01", due: false, timeboxId: "timebox-a" }];
    const input = {
        ...baseInput,
        completed: false,
        dueDayKey: null,
        timeboxes: [{ timeboxId: "timebox-a", start: new Date(2026, 8, 1, 9, 0), end: new Date(2026, 8, 1, 10, 0) }],
    };
    const result = await projectTaskDays(
        input,
        previousPlan,
        {
            ...dependencies(),
            writeReference: async (r) => void created.push(r.destinationPath),
            removeReference: async (r) => void removed.push(r.destinationPath),
        },
        false,
    );
    assert.equal(result.status, "success");
    assert.deepEqual(created, []);
    assert.deepEqual(removed, []);
});

test("a failed write is reported as partial and retry only repeats the failed destination", async () => {
    const succeeded: string[] = [];
    const result = await projectTaskDays({ ...baseInput, dueDayKey: "2026-09-03", timeboxes: [] }, [], {
        ...dependencies(),
        writeReference: async () => {
            throw new Error("disk full");
        },
    });
    assert.equal(result.status, "partial");

    const retried: string[] = [];
    const finalResult: TaskDayProjectionResult = await retryTaskDayProjection(
        result as Extract<TaskDayProjectionResult, { status: "partial" }>,
        {
            writeReference: async (r) => void retried.push(r.destinationPath),
            removeReference: async () => undefined,
        },
    );
    assert.deepEqual(finalResult, { status: "success", plan: [{ date: "2026-09-03", due: true, timeboxId: null }] });
    assert.deepEqual(retried, ["Daily/2026-09-03.md"]);
    assert.deepEqual(succeeded, []);
});
