import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("persistent plugin and Obsidian registration identifiers remain stable", async () => {
    const [manifestSource, pluginSource, timerViewSource, timelineViewSource] = await Promise.all([
        readFile(new URL("../manifest.json", import.meta.url), "utf8"),
        readFile(new URL("../src/main.ts", import.meta.url), "utf8"),
        readFile(new URL("../src/TimerView.ts", import.meta.url), "utf8"),
        readFile(new URL("../src/TimelineView.ts", import.meta.url), "utf8"),
    ]);
    const manifest = JSON.parse(manifestSource) as { id?: unknown };

    assert.equal(manifest.id, "focus-notes");
    assert.match(timerViewSource, /VIEW_TYPE_FOCUS_NOTES\s*=\s*["']focus-notes-view["']/);
    assert.match(timelineViewSource, /VIEW_TYPE_FOCUS_TIMELINE\s*=\s*["']focus-timeline-view["']/);
    assert.match(pluginSource, /registerHoverLinkSource\(["']focus-notes-inbox["']/);

    for (const commandId of [
        "open-focus-notes",
        "manage-active-note-events-tasks",
        "open-focus-timeline",
        "create-event-task",
    ]) {
        assert.match(pluginSource, new RegExp(`id:\\s*["']${commandId}["']`));
    }
});
