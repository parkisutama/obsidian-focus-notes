import assert from "node:assert/strict";
import test from "node:test";
import { resolveInboxFormTarget, selectInboxTarget } from "../src/InboxTarget.ts";
import { EventTaskFormState } from "../src/EventTaskFormState.ts";

test("useEventCaptureTarget uses the active Event/Task file but replaces its heading and position", () => {
    assert.deepEqual(
        selectInboxTarget({
            useEventCaptureTarget: true,
            eventTaskTarget: { file: "Planning.md", heading: "Schedule", position: "end" },
            periodicalTarget: { file: "Weekly/2026-W31.md", heading: "2026-08-02", position: "end" },
            heading: "Quick Inbox",
            position: "start",
        }),
        { file: "Planning.md", heading: "Quick Inbox", position: "start" },
    );
});

test("useEventCaptureTarget does not silently fall back when the active target is empty", () => {
    assert.equal(
        selectInboxTarget({
            useEventCaptureTarget: true,
            eventTaskTarget: { file: "", heading: "", position: "end" },
            periodicalTarget: { file: "Weekly/2026-W31.md", heading: "2026-08-02", position: "end" },
            heading: "Inbox",
            position: "end",
        }),
        null,
    );
});

test("periodical profile mode uses the resolved file and preserves its per-day heading", () => {
    assert.deepEqual(
        selectInboxTarget({
            useEventCaptureTarget: false,
            eventTaskTarget: { file: "Planning.md", heading: "Schedule", position: "end" },
            periodicalTarget: { file: "Weekly/2026-W31.md", heading: "2026-08-02", position: "end" },
            heading: "Moment",
            position: "start",
        }),
        { file: "Weekly/2026-W31.md", heading: "2026-08-02", position: "start" },
    );
});

test("periodical profile mode falls back to the configured heading when the profile has none", () => {
    assert.deepEqual(
        selectInboxTarget({
            useEventCaptureTarget: false,
            eventTaskTarget: { file: "Planning.md", heading: "Schedule", position: "end" },
            periodicalTarget: { file: "Daily/2026-08-02.md", heading: "", position: "end" },
            heading: "Moment",
            position: "start",
        }),
        { file: "Daily/2026-08-02.md", heading: "Moment", position: "start" },
    );
});

test("periodical profile mode does not silently fall back when the profile cannot resolve", () => {
    assert.equal(
        selectInboxTarget({
            useEventCaptureTarget: false,
            eventTaskTarget: { file: "Planning.md", heading: "Schedule", position: "end" },
            periodicalTarget: null,
            heading: "Moment",
            position: "end",
        }),
        null,
    );
    assert.equal(
        selectInboxTarget({
            useEventCaptureTarget: false,
            eventTaskTarget: { file: "Planning.md", heading: "Schedule", position: "end" },
            periodicalTarget: { file: "", heading: "", position: "end" },
            heading: "Moment",
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
