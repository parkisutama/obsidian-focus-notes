import assert from "node:assert/strict";
import test from "node:test";
import { settingsTabForSection } from "../src/SettingsLayout.ts";

test("groups settings sections into stable user-facing tabs", () => {
    assert.equal(settingsTabForSection("Default durations"), "focus");
    assert.equal(settingsTabForSection("Focus Timeline"), "timeline");
    assert.equal(settingsTabForSection("Inbox quick capture"), "capture");
    assert.equal(settingsTabForSection("Event & Task Creation"), "capture");
    assert.equal(settingsTabForSection("unknown"), "focus");
});
