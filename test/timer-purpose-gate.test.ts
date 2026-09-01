import assert from "node:assert/strict";
import test from "node:test";
import { evaluateTimerStartGate } from "../src/features/focus-session/domain/TimerPurposeGate.ts";

test("blocks starting with no purpose selected", () => {
    assert.deepEqual(evaluateTimerStartGate({ status: "none" }), { status: "blocked", reason: "no-purpose" });
});

test("Event and Task selections are ready without a Timebox", () => {
    assert.deepEqual(evaluateTimerStartGate({ status: "event", itemId: "event-abc", title: "Workshop" }), {
        status: "ready",
        owner: { kind: "event", itemId: "event-abc" },
    });
    assert.deepEqual(evaluateTimerStartGate({ status: "task", itemId: "task-abc", title: "Report" }), {
        status: "ready",
        owner: { kind: "task", itemId: "task-abc" },
    });
});
