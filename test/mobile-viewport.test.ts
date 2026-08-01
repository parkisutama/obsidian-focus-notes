import assert from "node:assert/strict";
import test from "node:test";
import { getMobileViewportMetrics } from "../src/MobileViewport.ts";

test("fits the mobile sheet below the workspace top when the keyboard opens", () => {
    assert.deepEqual(
        getMobileViewportMetrics(844, { height: 476, offsetTop: 0 }, 48, 8),
        { height: 420, offsetTop: 56, keyboardInset: 368 }
    );
});

test("uses the window viewport when visualViewport is unavailable", () => {
    assert.deepEqual(
        getMobileViewportMetrics(640, undefined, 40, 8),
        { height: 592, offsetTop: 48, keyboardInset: 0 }
    );
});

test("keeps a minimum system-bar clearance when the workspace starts at zero", () => {
    assert.deepEqual(
        getMobileViewportMetrics(844, { height: 844, offsetTop: 0 }, 0, 8),
        { height: 796, offsetTop: 48, keyboardInset: 0 }
    );
});
