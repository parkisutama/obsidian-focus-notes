import assert from "node:assert/strict";
import test from "node:test";
import {
    type EventDayProjectionResult,
    projectEventDays,
    retryEventDayProjection,
} from "../src/features/capture/scheduled-item/application/EventDayProjection.ts";

const baseInput = {
    title: "Workshop",
    start: new Date(2026, 8, 1, 9, 0),
    end: new Date(2026, 8, 3, 12, 0),
    allDay: false,
    canonicalFilePath: "Projects/Team.md",
    canonicalBlockId: "event-abc1234567",
    heading: "Activities & Tasks",
    position: "end" as const,
};

function dependencies(overrides: Partial<Parameters<typeof projectEventDays>[2]> = {}) {
    let counter = 0;
    return {
        resolveDayFile: (dayKey: string) => `Daily/${dayKey}.md`,
        writeReference: async () => undefined,
        removeReference: async () => undefined,
        createReferenceBlockId: () => `event-ref-mock${String(counter++).padStart(4, "0")}`,
        ...overrides,
    };
}

test("a brand-new cross-day Event writes a reference for every day but the canonical start day", async () => {
    const writes: string[] = [];
    const result = await projectEventDays(baseInput, [], {
        ...dependencies(),
        writeReference: async (request) => {
            writes.push(request.destinationPath);
        },
    });
    assert.deepEqual(result, { status: "success" });
    assert.deepEqual(writes, ["Daily/2026-09-02.md", "Daily/2026-09-03.md"]);
});

test("a same-day Event writes no references at all", async () => {
    const writes: string[] = [];
    const result = await projectEventDays({ ...baseInput, end: new Date(2026, 8, 1, 12, 0) }, [], {
        ...dependencies(),
        writeReference: async (request) => void writes.push(request.destinationPath),
    });
    assert.deepEqual(result, { status: "success" });
    assert.deepEqual(writes, []);
});

test("shrinking an Event's span removes the reference from the day no longer touched", async () => {
    const removed: string[] = [];
    const previousTouchedDayKeys = ["2026-09-01", "2026-09-02", "2026-09-03"];
    const result = await projectEventDays({ ...baseInput, end: new Date(2026, 8, 2, 12, 0) }, previousTouchedDayKeys, {
        ...dependencies(),
        removeReference: async (request) => void removed.push(request.destinationPath),
    });
    assert.deepEqual(result, { status: "success" });
    assert.deepEqual(removed, ["Daily/2026-09-03.md"]);
});

test("growing an Event's span only creates references for the newly touched days", async () => {
    const created: string[] = [];
    const result = await projectEventDays(baseInput, ["2026-09-01"], {
        ...dependencies(),
        writeReference: async (request) => void created.push(request.destinationPath),
    });
    assert.deepEqual(result, { status: "success" });
    assert.deepEqual(created, ["Daily/2026-09-02.md", "Daily/2026-09-03.md"]);
});

test("a failed day-reference write is reported as partial and retry only repeats the failed destination", async () => {
    let attempts = 0;
    const succeeded: string[] = [];
    const result = await projectEventDays(baseInput, [], {
        ...dependencies(),
        writeReference: async (request) => {
            attempts += 1;
            if (request.destinationPath === "Daily/2026-09-02.md") throw new Error("disk full");
            succeeded.push(request.destinationPath);
        },
    });
    assert.equal(result.status, "partial");
    assert.equal(attempts, 2);
    assert.deepEqual(succeeded, ["Daily/2026-09-03.md"]);

    const retried: string[] = [];
    const finalResult: EventDayProjectionResult = await retryEventDayProjection(
        result as Extract<EventDayProjectionResult, { status: "partial" }>,
        {
            writeReference: async (request) => void retried.push(request.destinationPath),
            removeReference: async () => undefined,
        },
    );
    assert.deepEqual(finalResult, { status: "success" });
    assert.deepEqual(retried, ["Daily/2026-09-02.md"]);
});
