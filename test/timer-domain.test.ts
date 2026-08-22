import assert from "node:assert/strict";
import test from "node:test";
import { toEngineMode } from "../src/features/focus-session/domain/Timer.ts";

test("Pomodoro and Timer use countdown while Stopwatch counts upward", () => {
    assert.equal(toEngineMode("pomodoro"), "countdown");
    assert.equal(toEngineMode("timer"), "countdown");
    assert.equal(toEngineMode("stopwatch"), "stopwatch");
});
