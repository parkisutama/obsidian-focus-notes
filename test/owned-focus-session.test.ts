import assert from "node:assert/strict";
import test from "node:test";
import { buildFocusSessionOwner } from "../src/features/focus-session/domain/OwnedFocusSession.ts";

test("builds a valid Task owner only when a timeboxId is provided", () => {
    assert.deepEqual(buildFocusSessionOwner("task", "task-abc1234567", "timebox-aaaaaaaaaa"), {
        status: "valid",
        owner: { kind: "task", itemId: "task-abc1234567", timeboxId: "timebox-aaaaaaaaaa" },
    });
    assert.deepEqual(buildFocusSessionOwner("task", "task-abc1234567", null), {
        status: "invalid",
        reason: "task-requires-timebox",
    });
});

test("builds a valid Event owner only when no timeboxId is provided", () => {
    assert.deepEqual(buildFocusSessionOwner("event", "event-abc1234567", null), {
        status: "valid",
        owner: { kind: "event", itemId: "event-abc1234567", timeboxId: null },
    });
    assert.deepEqual(buildFocusSessionOwner("event", "event-abc1234567", "timebox-aaaaaaaaaa"), {
        status: "invalid",
        reason: "event-forbids-timebox",
    });
});
