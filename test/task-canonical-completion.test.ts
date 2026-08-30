import assert from "node:assert/strict";
import test from "node:test";
import { applyCanonicalTaskCompletion } from "../src/features/capture/scheduled-item/domain/TaskCanonicalCompletion.ts";
import type { TaskTimebox } from "../src/features/capture/scheduled-item/domain/TaskTimebox.ts";

test("completing a Task checks its canonical line and cancels every still-planned timebox", () => {
    const timeboxes: TaskTimebox[] = [
        { timeboxId: "timebox-a", start: "2026-09-01 09:00", end: "2026-09-01 10:00", status: "planned" },
        { timeboxId: "timebox-b", start: "2026-08-30 09:00", end: "2026-08-30 10:00", status: "completed" },
    ];
    const result = applyCanonicalTaskCompletion(
        "- [ ] Menyusun laporan | due:2026-09-03 ^task-def4567890",
        timeboxes,
        true,
    );
    assert.equal(result?.firstLine, "- [x] Menyusun laporan | due:2026-09-03 ^task-def4567890");
    assert.deepEqual(result?.timeboxes, [
        { timeboxId: "timebox-a", start: "2026-09-01 09:00", end: "2026-09-01 10:00", status: "cancelled" },
        { timeboxId: "timebox-b", start: "2026-08-30 09:00", end: "2026-08-30 10:00", status: "completed" },
    ]);
});

test("un-completing a Task unchecks the line without restoring cancelled timeboxes", () => {
    const timeboxes: TaskTimebox[] = [
        { timeboxId: "timebox-a", start: "2026-09-01 09:00", end: "2026-09-01 10:00", status: "cancelled" },
    ];
    const result = applyCanonicalTaskCompletion(
        "- [x] Menyusun laporan | due:2026-09-03 ^task-def4567890",
        timeboxes,
        false,
    );
    assert.equal(result?.firstLine, "- [ ] Menyusun laporan | due:2026-09-03 ^task-def4567890");
    assert.deepEqual(result?.timeboxes, timeboxes);
});

test("is a no-op when the canonical already matches the requested completion state", () => {
    const result = applyCanonicalTaskCompletion("- [x] Menyusun laporan ^task-def4567890", [], true);
    assert.equal(result, null);
});

test("returns null for a line that isn't a valid Task", () => {
    const result = applyCanonicalTaskCompletion("Not a task line", [], true);
    assert.equal(result, null);
});
