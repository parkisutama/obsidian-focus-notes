import assert from "node:assert/strict";
import test from "node:test";
import { buildMobileScheduledItemFormModel } from "../src/MobileScheduledItemFormModel.ts";
import type { ScheduledItemFormData } from "../src/ScheduledItemFormData.ts";

const task: ScheduledItemFormData = {
    kind: "task",
    title: "Review invoice",
    description: "With @{People/Rachel.md}",
    objectReferences: [{ path: "People/Rachel.md" }],
    detailNote: { mode: "none" },
    completed: false,
    priority: "high",
    due: "2026-08-16",
    timebox: null,
    reminders: [],
};

test("mobile create and edit share presentation while retaining mode-specific context", () => {
    const create = buildMobileScheduledItemFormModel({
        mode: "create",
        data: task,
        contextLabel: "Planning.md · Activities & Tasks",
        busy: false,
        recovery: false,
    });
    const edit = buildMobileScheduledItemFormModel({
        mode: "edit",
        data: task,
        contextLabel: "Planning.md · Line 12",
        busy: false,
        recovery: false,
    });

    assert.equal(create.heading, "Create Task");
    assert.equal(create.submitLabel, "Create Task");
    assert.equal(create.showCreateTarget, true);
    assert.equal(edit.heading, "Edit Task");
    assert.equal(edit.submitLabel, "Save changes");
    assert.equal(edit.showCreateTarget, false);
    assert.deepEqual(create.sections, edit.sections);
});

test("mobile recovery freezes fields but keeps retry and cancel available", () => {
    const model = buildMobileScheduledItemFormModel({
        mode: "edit",
        data: task,
        contextLabel: "Planning.md · Line 12",
        busy: false,
        recovery: true,
    });

    assert.equal(model.fieldsDisabled, true);
    assert.equal(model.submitDisabled, false);
    assert.equal(model.submitLabel, "Retry remaining writes");
    assert.equal(model.ariaBusy, "false");
});

test("mobile busy state disables duplicate submission", () => {
    const model = buildMobileScheduledItemFormModel({
        mode: "create",
        data: { ...task, kind: "event", allDay: true, start: "2026-08-16", end: null, status: "planned", actual: null },
        contextLabel: "Daily/2026-08-16.md",
        busy: true,
        recovery: false,
    });

    assert.equal(model.heading, "Create Event");
    assert.equal(model.fieldsDisabled, true);
    assert.equal(model.submitDisabled, true);
    assert.equal(model.submitLabel, "Saving…");
    assert.equal(model.ariaBusy, "true");
});
