import assert from "node:assert/strict";
import test from "node:test";
import { buildDesktopScheduledItemFormModel } from "../src/DesktopScheduledItemFormModel.ts";
import type { ScheduledItemFormData } from "../src/ScheduledItemFormData.ts";

const task: ScheduledItemFormData = {
    kind: "task",
    title: "Prepare invoice",
    description: "Ask @{People/Rachel.md}",
    objectReferences: [{ label: "Rachel", vaultPath: "People/Rachel.md" }],
    detailNote: { mode: "none" },
    completed: false,
    priority: "high",
    due: "2026-08-25",
    timebox: null,
    reminders: [],
};

test("uses one desktop composition for Create and Edit with mode-specific context and actions", () => {
    const create = buildDesktopScheduledItemFormModel({
        mode: "create",
        data: task,
        contextLabel: "Tasks.md · Tasks · End",
        busy: false,
        recovery: false,
    });
    const edit = buildDesktopScheduledItemFormModel({
        mode: "edit",
        data: task,
        contextLabel: "Tasks.md · Line 12",
        busy: false,
        recovery: false,
    });

    assert.equal(create.heading, "Create Task");
    assert.equal(create.submitLabel, "Create task");
    assert.equal(create.contextLabel, "Tasks.md · Tasks · End");
    assert.equal(edit.heading, "Edit Task");
    assert.equal(edit.submitLabel, "Save changes");
    assert.equal(edit.contextLabel, "Tasks.md · Line 12");
    assert.deepEqual(create.sections, edit.sections);
    assert.deepEqual(create.sections, ["identity", "task", "description", "detail"]);
});

test("derives Event actual-time and Detail Note disclosures from semantic state", () => {
    const event: ScheduledItemFormData = {
        kind: "event",
        title: "Project review",
        description: "",
        objectReferences: [],
        detailNote: { mode: "create", name: "Review detail", folder: "Details" },
        allDay: false,
        start: "2026-08-26 09:00",
        end: "2026-08-26 10:00",
        status: "completed",
        actual: { start: "2026-08-26 09:05", end: "2026-08-26 09:55" },
    };
    const model = buildDesktopScheduledItemFormModel({
        mode: "edit",
        data: event,
        contextLabel: "Daily.md · Line 4",
        busy: false,
        recovery: false,
    });

    assert.deepEqual(model.sections, ["identity", "event", "description", "detail"]);
    assert.equal(model.showEventTimes, true);
    assert.equal(model.showActualTimes, true);
    assert.equal(model.detailFields, "create");
});

test("provides accessible busy and recovery action states", () => {
    const busy = buildDesktopScheduledItemFormModel({
        mode: "edit",
        data: task,
        contextLabel: "Tasks.md · Line 12",
        busy: true,
        recovery: false,
    });
    const recovery = buildDesktopScheduledItemFormModel({
        mode: "edit",
        data: task,
        contextLabel: "Tasks.md · Line 12",
        busy: false,
        recovery: true,
    });

    assert.equal(busy.submitLabel, "Saving…");
    assert.equal(busy.submitDisabled, true);
    assert.equal(busy.ariaBusy, "true");
    assert.equal(recovery.submitLabel, "Retry pending writes");
    assert.equal(recovery.submitDisabled, false);
});
