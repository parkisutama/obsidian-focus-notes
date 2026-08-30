import assert from "node:assert/strict";
import test from "node:test";
import { summarizeFocusUtilization } from "../src/features/focus-session/domain/FocusUtilization.ts";

test("sums multiple actual sessions against one planned duration", () => {
    assert.deepEqual(summarizeFocusUtilization(7200, [{ durationSeconds: 1500 }, { durationSeconds: 1500 }]), {
        plannedSeconds: 7200,
        focusedSeconds: 3000,
        sessionCount: 2,
    });
});

test("reports zero focused time without any logged sessions", () => {
    assert.deepEqual(summarizeFocusUtilization(1500, []), {
        plannedSeconds: 1500,
        focusedSeconds: 0,
        sessionCount: 0,
    });
});
