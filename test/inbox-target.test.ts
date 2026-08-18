import assert from "node:assert/strict";
import test from "node:test";
import { resolveInboxFormTarget, selectInboxTarget } from "../src/InboxTarget.ts";
import { EventTaskFormState } from "../src/EventTaskFormState.ts";

test("uses the captured-date Daily Note with Inbox overrides", () => {
    assert.deepEqual(
        selectInboxTarget({
            mode: "daily-note",
            dailyNoteTarget: { file: "Daily/2026-08-02.md", heading: "", position: "end" },
            eventTaskTarget: { file: "Planning.md", heading: "Schedule", position: "end" },
            weeklyNoteTarget: { file: "Weekly/2026-W31.md", heading: "2026-08-02", position: "end" },
            heading: "Inbox",
            position: "start",
        }),
        { file: "Daily/2026-08-02.md", heading: "Inbox", position: "start" },
    );
});

test("uses the active Event/Task file but replaces its heading and position", () => {
    assert.deepEqual(
        selectInboxTarget({
            mode: "event-task-target",
            dailyNoteTarget: null,
            eventTaskTarget: { file: "Planning.md", heading: "Schedule", position: "end" },
            weeklyNoteTarget: { file: "Weekly/2026-W31.md", heading: "2026-08-02", position: "end" },
            heading: "Quick Inbox",
            position: "start",
        }),
        { file: "Planning.md", heading: "Quick Inbox", position: "start" },
    );
});

test("weekly-note mode uses the resolved weekly file and preserves its per-day heading", () => {
    assert.deepEqual(
        selectInboxTarget({
            mode: "weekly-note",
            dailyNoteTarget: null,
            eventTaskTarget: { file: "Planning.md", heading: "Schedule", position: "end" },
            weeklyNoteTarget: { file: "Weekly/2026-W31.md", heading: "2026-08-02", position: "end" },
            heading: "Moment",
            position: "start",
        }),
        { file: "Weekly/2026-W31.md", heading: "2026-08-02", position: "start" },
    );
});

test("weekly-note mode falls back to the configured heading when the weekly target has none", () => {
    assert.deepEqual(
        selectInboxTarget({
            mode: "weekly-note",
            dailyNoteTarget: null,
            eventTaskTarget: { file: "Planning.md", heading: "Schedule", position: "end" },
            weeklyNoteTarget: { file: "Weekly/2026-W31.md", heading: "", position: "end" },
            heading: "Moment",
            position: "start",
        }),
        { file: "Weekly/2026-W31.md", heading: "Moment", position: "start" },
    );
});

test("weekly-note mode does not silently fall back when the weekly file cannot resolve", () => {
    assert.equal(
        selectInboxTarget({
            mode: "weekly-note",
            dailyNoteTarget: { file: "Daily.md", heading: "", position: "end" },
            eventTaskTarget: { file: "Planning.md", heading: "Schedule", position: "end" },
            weeklyNoteTarget: { file: "", heading: "", position: "end" },
            heading: "Moment",
            position: "end",
        }),
        null,
    );
});

test("does not silently fall back when the selected target cannot resolve", () => {
    assert.equal(
        selectInboxTarget({
            mode: "daily-note",
            dailyNoteTarget: null,
            eventTaskTarget: { file: "Planning.md", heading: "Schedule", position: "end" },
            weeklyNoteTarget: { file: "Weekly/2026-W31.md", heading: "2026-08-02", position: "end" },
            heading: "Inbox",
            position: "end",
        }),
        null,
    );
    assert.equal(
        selectInboxTarget({
            mode: "event-task-target",
            dailyNoteTarget: { file: "Daily.md", heading: "", position: "end" },
            eventTaskTarget: { file: "", heading: "", position: "end" },
            weeklyNoteTarget: { file: "Weekly/2026-W31.md", heading: "2026-08-02", position: "end" },
            heading: "Inbox",
            position: "end",
        }),
        null,
    );
});

test("uses the directly editable Inbox target for every renderer", () => {
    const capturedAt = new Date(2026, 7, 2, 15, 40);
    const form = new EventTaskFormState(capturedAt, {
        file: "Planning.md",
        heading: "Schedule",
        position: "end",
        hubNotesFolder: "Hub",
        detailNotesFolder: "Details",
        inboxTargetFile: "Captures/Quick.md",
    });
    form.inboxHeading = "## Quick Inbox";
    form.inboxPosition = "start";

    const resolved = resolveInboxFormTarget(
        {
            resolve: (target) => ({ ...target, file: target.file.replace("Quick", "2026-08-02") }),
        },
        form,
    );

    assert.deepEqual(resolved, {
        file: "Captures/2026-08-02.md",
        heading: "Quick Inbox",
        position: "start",
    });
});
