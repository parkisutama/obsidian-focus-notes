import assert from "node:assert/strict";
import test from "node:test";
import { evaluateTimerStartGate } from "../src/features/focus-session/domain/TimerPurposeGate.ts";

test("blocks starting with no purpose selected", () => {
    assert.deepEqual(evaluateTimerStartGate({ status: "none" }), { status: "blocked", reason: "no-purpose" });
});

test("an Event selection is ready immediately, with no timebox", () => {
    assert.deepEqual(evaluateTimerStartGate({ status: "event", itemId: "event-abc1234567", title: "Workshop" }), {
        status: "ready",
        owner: { kind: "event", itemId: "event-abc1234567", timeboxId: null },
    });
});

test("a Task selection without a timebox is blocked, not silently allowed", () => {
    assert.deepEqual(
        evaluateTimerStartGate({ status: "task", itemId: "task-abc1234567", title: "Report", timeboxId: null }),
        { status: "blocked", reason: "task-needs-timebox" },
    );
});

test("a Task selection with a timebox is ready", () => {
    assert.deepEqual(
        evaluateTimerStartGate({
            status: "task",
            itemId: "task-abc1234567",
            title: "Report",
            timeboxId: "timebox-aaaaaaaaaa",
        }),
        {
            status: "ready",
            owner: { kind: "task", itemId: "task-abc1234567", timeboxId: "timebox-aaaaaaaaaa" },
        },
    );
});
