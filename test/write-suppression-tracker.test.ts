import assert from "node:assert/strict";
import test from "node:test";
import { WriteSuppressionTracker } from "../src/infrastructure/obsidian/capture/WriteSuppressionTracker.ts";

function fakeClock() {
    const pending = new Map<number, () => void>();
    let nextHandle = 1;
    return {
        schedule: (fn: () => void): number => {
            const handle = nextHandle++;
            pending.set(handle, fn);
            return handle;
        },
        cancel: (handle: number): void => {
            pending.delete(handle);
        },
        fireAll: (): void => {
            for (const fn of pending.values()) fn();
            pending.clear();
        },
        pendingCount: (): number => pending.size,
    };
}

test("a path is suppressed between beginSuppress and endSuppress", () => {
    const clock = fakeClock();
    const tracker = new WriteSuppressionTracker(500, clock.schedule, clock.cancel);
    assert.equal(tracker.isSuppressed("Daily/2026-09-01.md"), false);
    tracker.beginSuppress("Daily/2026-09-01.md");
    assert.equal(tracker.isSuppressed("Daily/2026-09-01.md"), true);
});

test("suppression persists through the grace period after endSuppress, then clears", () => {
    const clock = fakeClock();
    const tracker = new WriteSuppressionTracker(500, clock.schedule, clock.cancel);
    tracker.beginSuppress("Daily/2026-09-01.md");
    tracker.endSuppress("Daily/2026-09-01.md");
    assert.equal(tracker.isSuppressed("Daily/2026-09-01.md"), true);
    clock.fireAll();
    assert.equal(tracker.isSuppressed("Daily/2026-09-01.md"), false);
});

test("nested begin/end pairs on the same path only clear after the outermost end's grace period", () => {
    const clock = fakeClock();
    const tracker = new WriteSuppressionTracker(500, clock.schedule, clock.cancel);
    tracker.beginSuppress("Daily/2026-09-01.md");
    tracker.beginSuppress("Daily/2026-09-01.md");
    tracker.endSuppress("Daily/2026-09-01.md");
    assert.equal(tracker.isSuppressed("Daily/2026-09-01.md"), true, "still held by the outer begin");
    tracker.endSuppress("Daily/2026-09-01.md");
    assert.equal(tracker.isSuppressed("Daily/2026-09-01.md"), true, "grace period after final end");
    clock.fireAll();
    assert.equal(tracker.isSuppressed("Daily/2026-09-01.md"), false);
});

test("a new beginSuppress during the grace period cancels the pending clear", () => {
    const clock = fakeClock();
    const tracker = new WriteSuppressionTracker(500, clock.schedule, clock.cancel);
    tracker.beginSuppress("Daily/2026-09-01.md");
    tracker.endSuppress("Daily/2026-09-01.md");
    assert.equal(clock.pendingCount(), 1);
    tracker.beginSuppress("Daily/2026-09-01.md");
    assert.equal(clock.pendingCount(), 0, "pending clear timer was cancelled");
    assert.equal(tracker.isSuppressed("Daily/2026-09-01.md"), true);
});

test("different paths are tracked independently", () => {
    const clock = fakeClock();
    const tracker = new WriteSuppressionTracker(500, clock.schedule, clock.cancel);
    tracker.beginSuppress("Daily/2026-09-01.md");
    assert.equal(tracker.isSuppressed("Daily/2026-09-02.md"), false);
});
