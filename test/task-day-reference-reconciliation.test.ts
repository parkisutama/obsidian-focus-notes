import assert from "node:assert/strict";
import test from "node:test";
import { reconcileTaskDayReferences } from "../src/features/capture/scheduled-item/domain/TaskDayReferenceReconciliation.ts";

test("creates a reference that canonical truth expects but no Daily note has yet", () => {
    const result = reconcileTaskDayReferences(
        [
            {
                canonicalTarget: "Tasks/Report.md#^task-abc1234567",
                dueDayKey: "2026-09-03",
                timeboxes: [],
            },
        ],
        [],
    );
    assert.deepEqual(result, {
        toCreate: [
            {
                canonicalTarget: "Tasks/Report.md#^task-abc1234567",
                entry: { date: "2026-09-03", due: true, timeboxId: null },
            },
        ],
        toRemove: [],
        orphanReferences: [],
        ambiguousTargets: [],
    });
});

test("removes a stale reference whose canonical Task no longer touches that day", () => {
    const result = reconcileTaskDayReferences(
        [{ canonicalTarget: "Tasks/Report.md#^task-abc1234567", dueDayKey: "2026-09-05", timeboxes: [] }],
        [
            {
                canonicalTarget: "Tasks/Report.md#^task-abc1234567",
                destinationPath: "Daily/2026-09-03.md",
                date: "2026-09-03",
                due: true,
                timeboxId: null,
            },
        ],
    );
    assert.deepEqual(result.toCreate, [
        {
            canonicalTarget: "Tasks/Report.md#^task-abc1234567",
            entry: { date: "2026-09-05", due: true, timeboxId: null },
        },
    ]);
    assert.deepEqual(result.toRemove, [
        {
            canonicalTarget: "Tasks/Report.md#^task-abc1234567",
            entry: { date: "2026-09-03", due: true, timeboxId: null },
        },
    ]);
});

test("a converged vault produces no changes at all (idempotent rebuild)", () => {
    const canonical = [
        {
            canonicalTarget: "Tasks/Report.md#^task-abc1234567",
            dueDayKey: "2026-09-03",
            timeboxes: [
                {
                    timeboxId: "timebox-aaaaaaaaaa",
                    start: new Date(2026, 8, 3, 9, 0),
                    end: new Date(2026, 8, 3, 11, 0),
                },
            ],
        },
    ];
    const existing = [
        {
            canonicalTarget: "Tasks/Report.md#^task-abc1234567",
            destinationPath: "Daily/2026-09-03.md",
            date: "2026-09-03",
            due: true,
            timeboxId: "timebox-aaaaaaaaaa",
        },
    ];
    const result = reconcileTaskDayReferences(canonical, existing);
    assert.deepEqual(result.toCreate, []);
    assert.deepEqual(result.toRemove, []);
    assert.deepEqual(result.orphanReferences, []);
});

test("reports an existing reference as orphaned when its canonical Task no longer exists in the vault", () => {
    const orphan = {
        canonicalTarget: "Tasks/Report.md#^task-abc1234567",
        destinationPath: "Daily/2026-09-03.md",
        date: "2026-09-03",
        due: true,
        timeboxId: null,
    };
    const result = reconcileTaskDayReferences([], [orphan]);
    assert.deepEqual(result.toCreate, []);
    assert.deepEqual(result.toRemove, []);
    assert.deepEqual(result.orphanReferences, [orphan]);
});

test("skips reconciling a duplicated (ambiguous) canonical target instead of guessing", () => {
    const duplicate = { canonicalTarget: "Tasks/Report.md#^task-abc1234567", dueDayKey: "2026-09-03", timeboxes: [] };
    const result = reconcileTaskDayReferences(
        [duplicate, duplicate],
        [
            {
                canonicalTarget: "Tasks/Report.md#^task-abc1234567",
                destinationPath: "Daily/2026-09-01.md",
                date: "2026-09-01",
                due: false,
                timeboxId: null,
            },
        ],
    );
    assert.deepEqual(result.toCreate, []);
    assert.deepEqual(result.toRemove, []);
    assert.deepEqual(result.ambiguousTargets, ["Tasks/Report.md#^task-abc1234567"]);
});
