import assert from "node:assert/strict";
import test from "node:test";
import { selectInboxTarget } from "../src/InboxTarget.ts";

test("uses the captured-date Daily Note with Inbox overrides", () => {
    assert.deepEqual(
        selectInboxTarget({
            mode: "daily-note",
            dailyNoteTarget: { file: "Daily/2026-08-02.md", heading: "", position: "end" },
            eventTaskTarget: { file: "Planning.md", heading: "Schedule", position: "end" },
            heading: "Inbox",
            position: "start"
        }),
        { file: "Daily/2026-08-02.md", heading: "Inbox", position: "start" }
    );
});

test("uses the active Event/Task file but replaces its heading and position", () => {
    assert.deepEqual(
        selectInboxTarget({
            mode: "event-task-target",
            dailyNoteTarget: null,
            eventTaskTarget: { file: "Planning.md", heading: "Schedule", position: "end" },
            heading: "Quick Inbox",
            position: "start"
        }),
        { file: "Planning.md", heading: "Quick Inbox", position: "start" }
    );
});

test("does not silently fall back when the selected target cannot resolve", () => {
    assert.equal(
        selectInboxTarget({
            mode: "daily-note",
            dailyNoteTarget: null,
            eventTaskTarget: { file: "Planning.md", heading: "Schedule", position: "end" },
            heading: "Inbox",
            position: "end"
        }),
        null
    );
    assert.equal(
        selectInboxTarget({
            mode: "event-task-target",
            dailyNoteTarget: { file: "Daily.md", heading: "", position: "end" },
            eventTaskTarget: { file: "", heading: "", position: "end" },
            heading: "Inbox",
            position: "end"
        }),
        null
    );
});
