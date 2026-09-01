import assert from "node:assert/strict";
import test from "node:test";
import { buildFocusSessionOwner } from "../src/features/focus-session/domain/OwnedFocusSession.ts";

test("Task and Event owners require only their stable item identity", () => {
    assert.deepEqual(buildFocusSessionOwner("task", "task-abc1234567"), {
        status: "valid",
        owner: { kind: "task", itemId: "task-abc1234567" },
    });
    assert.deepEqual(buildFocusSessionOwner("event", "event-abc1234567"), {
        status: "valid",
        owner: { kind: "event", itemId: "event-abc1234567" },
    });
});
