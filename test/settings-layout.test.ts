import assert from "node:assert/strict";
import test from "node:test";
import { settingsTabForSection } from "../src/SettingsLayout.ts";

test("groups settings sections into stable user-facing tabs", () => {
    assert.equal(settingsTabForSection("Default durations"), "focus");
    assert.equal(settingsTabForSection("Focus Timeline"), "timeline");
    assert.equal(settingsTabForSection("Moment quick capture"), "capture");
    assert.equal(settingsTabForSection("Event capture"), "capture");
    assert.equal(settingsTabForSection("Task & shared note creation"), "capture");
    assert.equal(settingsTabForSection("Periodical Notes"), "periodical");
    assert.equal(settingsTabForSection("unknown"), "focus");
});
