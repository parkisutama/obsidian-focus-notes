import assert from "node:assert/strict";
import test from "node:test";
import { reconcileEventDayReferences } from "../src/features/capture/scheduled-item/domain/EventDayReferenceReconciliation.ts";

test("creates references for every day a multi-day Event touches beyond its own canonical day", () => {
    const result = reconcileEventDayReferences(
        [
            {
                canonicalTarget: "Projects/Team.md#^event-abc1234567",
                canonicalDayKey: "2026-09-01",
                touchedDayKeys: ["2026-09-01", "2026-09-02", "2026-09-03"],
            },
        ],
        [],
    );
    assert.deepEqual(result, {
        toCreate: [
            { canonicalTarget: "Projects/Team.md#^event-abc1234567", dayKey: "2026-09-02" },
            { canonicalTarget: "Projects/Team.md#^event-abc1234567", dayKey: "2026-09-03" },
        ],
        toRemove: [],
        orphanReferences: [],
        ambiguousTargets: [],
    });
});

test("removes a reference for a day the Event no longer touches", () => {
    const result = reconcileEventDayReferences(
        [
            {
                canonicalTarget: "Projects/Team.md#^event-abc1234567",
                canonicalDayKey: "2026-09-01",
                touchedDayKeys: ["2026-09-01", "2026-09-02"],
            },
        ],
        [
            {
                canonicalTarget: "Projects/Team.md#^event-abc1234567",
                destinationPath: "Daily/2026-09-05.md",
                dayKey: "2026-09-05",
            },
        ],
    );
    assert.deepEqual(result.toCreate, [
        { canonicalTarget: "Projects/Team.md#^event-abc1234567", dayKey: "2026-09-02" },
    ]);
    assert.deepEqual(result.toRemove, [
        { canonicalTarget: "Projects/Team.md#^event-abc1234567", dayKey: "2026-09-05" },
    ]);
});

test("a converged vault produces no changes at all", () => {
    const result = reconcileEventDayReferences(
        [
            {
                canonicalTarget: "Projects/Team.md#^event-abc1234567",
                canonicalDayKey: "2026-09-01",
                touchedDayKeys: ["2026-09-01", "2026-09-02"],
            },
        ],
        [
            {
                canonicalTarget: "Projects/Team.md#^event-abc1234567",
                destinationPath: "Daily/2026-09-02.md",
                dayKey: "2026-09-02",
            },
        ],
    );
    assert.deepEqual(result.toCreate, []);
    assert.deepEqual(result.toRemove, []);
});

test("reports an orphaned reference whose canonical Event no longer exists", () => {
    const orphan = {
        canonicalTarget: "Projects/Team.md#^event-abc1234567",
        destinationPath: "Daily/2026-09-02.md",
        dayKey: "2026-09-02",
    };
    const result = reconcileEventDayReferences([], [orphan]);
    assert.deepEqual(result.orphanReferences, [orphan]);
});

test("skips a duplicated (ambiguous) canonical target instead of guessing", () => {
    const duplicate = {
        canonicalTarget: "Projects/Team.md#^event-abc1234567",
        canonicalDayKey: "2026-09-01",
        touchedDayKeys: ["2026-09-01", "2026-09-02"],
    };
    const result = reconcileEventDayReferences([duplicate, duplicate], []);
    assert.deepEqual(result.toCreate, []);
    assert.deepEqual(result.ambiguousTargets, ["Projects/Team.md#^event-abc1234567"]);
});
