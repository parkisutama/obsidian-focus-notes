import assert from "node:assert/strict";
import test from "node:test";
import { EventTaskFormState } from "../src/EventTaskFormState.ts";
import {
    scheduledEventFormDataFromLineEdit,
    scheduledItemFormDataFromCreateState,
    scheduledTaskFormDataFromLineEdit,
    type ScheduledItemFormPersistenceContext,
} from "../src/ScheduledItemFormData.ts";

function createState(): EventTaskFormState {
    return new EventTaskFormState(new Date(2026, 7, 15, 9, 0), {
        file: "Projects/Alpha.md",
        heading: "Tasks",
        position: "end",
        hubNotesFolder: "Objects",
        detailNotesFolder: "Details",
    });
}

test("adapts create Task state into the shared semantic contract", () => {
    const state = createState();
    state.kind = "task";
    state.title = "Review proposal";
    state.description = "Discuss with @Ana and @{People/Rachel.md}.";
    state.taskPriority = "high";
    state.taskDueHasTime = true;
    state.taskDueTime = "10:30";
    state.taskTimeboxEnabled = true;
    state.taskTimeboxStartTime = "09:00";
    state.taskTimeboxEndTime = "10:00";
    state.reminders = [{ date: "2026-08-15", time: "08:30" }];
    state.detailNoteEnabled = true;
    state.detailNoteName = "Proposal review";

    assert.deepEqual(scheduledItemFormDataFromCreateState(state), {
        kind: "task",
        title: "Review proposal",
        description: "Discuss with @Ana and @{People/Rachel.md}.",
        objectReferences: [
            { label: "Ana", vaultPath: null },
            { label: "Rachel", vaultPath: "People/Rachel.md" },
        ],
        detailNote: { mode: "create", name: "Proposal review", folder: "Details" },
        completed: false,
        priority: "high",
        due: "2026-08-15 10:30",
        timebox: { start: "2026-08-15 09:00", end: "2026-08-15 10:00" },
        reminders: ["2026-08-15 08:30"],
    });
});

test("adapts Task line-edit fields without changing semantic values", () => {
    assert.deepEqual(
        scheduledTaskFormDataFromLineEdit({
            title: "Ship release",
            description: "Coordinate @{Teams/Release.md}",
            detailNote: { mode: "link", path: "Details/Release.md" },
            edit: {
                completed: true,
                priority: "medium",
                due: "2026-08-20",
                timebox: null,
                reminders: ["2026-08-20 08:00"],
            },
        }),
        {
            kind: "task",
            title: "Ship release",
            description: "Coordinate @{Teams/Release.md}",
            objectReferences: [{ label: "Release", vaultPath: "Teams/Release.md" }],
            detailNote: { mode: "link", path: "Details/Release.md" },
            completed: true,
            priority: "medium",
            due: "2026-08-20",
            timebox: null,
            reminders: ["2026-08-20 08:00"],
        },
    );
});

test("adapts Event line-edit fields into the same discriminated contract", () => {
    assert.deepEqual(
        scheduledEventFormDataFromLineEdit({
            title: "Project review",
            description: "With @Ana",
            detailNote: { mode: "none" },
            edit: {
                allDay: false,
                start: "2026-08-21 13:00",
                end: "2026-08-21 14:00",
                status: "completed",
                actual: { start: "2026-08-21 13:05", end: "2026-08-21 13:55" },
            },
        }),
        {
            kind: "event",
            title: "Project review",
            description: "With @Ana",
            objectReferences: [{ label: "Ana", vaultPath: null }],
            detailNote: { mode: "none" },
            allDay: false,
            start: "2026-08-21 13:00",
            end: "2026-08-21 14:00",
            status: "completed",
            actual: { start: "2026-08-21 13:05", end: "2026-08-21 13:55" },
        },
    );
});

test("keeps persistence context outside semantic form data", () => {
    const create: ScheduledItemFormPersistenceContext = {
        mode: "create",
        targetFile: "Projects/Alpha.md",
        targetHeading: "Tasks",
        targetPosition: "end",
    };
    const edit: ScheduledItemFormPersistenceContext = {
        mode: "edit",
        sourcePath: "Projects/Alpha.md",
        sourceLine: 12,
        sourceText: "- [ ] Review proposal",
    };

    assert.equal(create.mode, "create");
    assert.equal(edit.mode, "edit");
    assert.equal(
        "targetFile" in scheduledItemFormDataFromCreateState(Object.assign(createState(), { kind: "task" })),
        false,
    );
});
