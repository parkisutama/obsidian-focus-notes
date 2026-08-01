import assert from "node:assert/strict";
import test from "node:test";
import { getMobileViewportMetrics } from "../src/MobileViewport.ts";

test("anchors the mobile screen to the visible viewport when the keyboard opens", () => {
    assert.deepEqual(
        getMobileViewportMetrics(844, { height: 476, offsetTop: 0 }),
        { height: 476, offsetTop: 0, keyboardInset: 368 }
    );
});

test("uses the window viewport when visualViewport is unavailable", () => {
    assert.deepEqual(
        getMobileViewportMetrics(640),
        { height: 640, offsetTop: 0, keyboardInset: 0 }
    );
});
