import assert from "node:assert/strict";
import test from "node:test";
import { captureLedgerRecord } from "../src/LedgerRecordSource.ts";
import {
    buildScheduledItemFormBlockEdit,
    hydrateScheduledItemFormEdit,
    validateScheduledItemFormData,
} from "../src/ScheduledItemFormAdapter.ts";
import type { ScheduledItemFormData } from "../src/ScheduledItemFormData.ts";

function capture(rawBlock: string) {
    const rawLine = rawBlock.split(/\r?\n/)[0];
    const result = captureLedgerRecord(rawBlock, { filePath: "Tasks.md", lineNumber: 1, rawLine });
    assert.equal(result.status, "captured");
    if (result.status !== "captured") throw new Error("fixture did not capture");
    return result.snapshot;
}

test("hydrates Task and Event edits through the shared form contract", () => {
    const task = hydrateScheduledItemFormEdit({
        kind: "task",
        title: "Review proposal",
        snapshot: capture(
            "- [X] Review proposal | owner:Ana | priority:high | due:2026-08-20\n" +
                "    - Ask @{People/Ana.md}\n    - detail: [Review details](Details/Review.md)",
        ),
    });
    assert.equal(task.status, "ready");
    if (task.status === "ready") {
        assert.equal(task.data.kind, "task");
        assert.equal(task.data.description, "Ask @{People/Ana.md}");
        assert.deepEqual(task.data.detailNote, { mode: "link", path: "Details/Review.md" });
        assert.equal(task.data.kind === "task" && task.data.completed, true);
    }

    const event = hydrateScheduledItemFormEdit({
        kind: "event",
        title: "Planning",
        snapshot: capture("- 2026-08-21 09:00 - 10:00 Planning | status:completed"),
    });
    assert.equal(event.status, "ready");
    assert.equal(event.status === "ready" && event.data.kind, "event");
});

test("applies identical validation rules independent of persistence mode", () => {
    const invalid: ScheduledItemFormData = {
        kind: "event",
        title: "Invalid event",
        description: "",
        objectReferences: [],
        detailNote: { mode: "none" },
        allDay: false,
        start: "2026-08-21 10:00",
        end: "2026-08-21 09:00",
        status: "planned",
        actual: null,
    };
    assert.deepEqual(validateScheduledItemFormData(invalid), {
        valid: false,
        field: "end",
        message: "Event end must be later than start.",
    });

    assert.deepEqual(validateScheduledItemFormData({ ...invalid, title: "" }), {
        valid: false,
        field: "title",
        message: "Title is required.",
    });
});

test("builds canonical create output and lossless edit output from the same data", () => {
    const data: ScheduledItemFormData = {
        kind: "task",
        title: "Revised proposal",
        description: "First line\nSecond line",
        objectReferences: [],
        detailNote: { mode: "link", path: "Details/Revised proposal.md" },
        completed: true,
        priority: "medium",
        due: "2026-08-22 17:00",
        timebox: null,
        reminders: [],
    };

    assert.deepEqual(buildScheduledItemFormBlockEdit(data), {
        status: "ready",
        edit: {
            firstLine: "- [x] Revised proposal | priority:medium | due:2026-08-22 17:00",
            description: "First line\nSecond line",
            detailNote: {
                mode: "link",
                title: "Revised proposal",
                path: "Details/Revised proposal.md",
            },
        },
    });

    const snapshot = capture(
        "- [ ] [Old proposal](Legacy/Proposal.md) | owner:Ana | priority:low\n" +
            "    - Old description\n    - detail: [Custom detail title](Details/Revised%20proposal.md)\n" +
            "    - [ ] Keep child",
    );
    assert.deepEqual(buildScheduledItemFormBlockEdit(data, snapshot), {
        status: "ready",
        edit: {
            firstLine:
                "- [x] [Revised proposal](Legacy/Proposal.md) | owner:Ana | priority:medium | due:2026-08-22 17:00",
            description: "First line\nSecond line",
            detailNote: {
                mode: "link",
                title: "Custom detail title",
                path: "Details/Revised proposal.md",
            },
        },
    });
});

test("updates Event title and lifecycle while preserving a legacy Wikilink and unknown metadata", () => {
    const data: ScheduledItemFormData = {
        kind: "event",
        title: "Revised planning",
        description: "",
        objectReferences: [],
        detailNote: { mode: "none" },
        allDay: false,
        start: "2026-08-23 09:30",
        end: "2026-08-23 11:00",
        status: "cancelled",
        actual: null,
    };
    const snapshot = capture("- 2026-08-23 09:00 - 10:00 [[Meetings/Planning|Planning]] | owner:Ana");

    assert.deepEqual(buildScheduledItemFormBlockEdit(data, snapshot), {
        status: "ready",
        edit: {
            firstLine:
                "- 2026-08-23 09:30 - 11:00 [[Meetings/Planning|Revised planning]] | owner:Ana | status:cancelled",
            description: "",
            detailNote: { mode: "none" },
        },
    });
});

test("rejects stale derived Object References and invalid detail paths", () => {
    const data: ScheduledItemFormData = {
        kind: "task",
        title: "Task",
        description: "Ask @{People/Ana.md}",
        objectReferences: [],
        detailNote: { mode: "link", path: "../Outside.md" },
        completed: false,
        priority: "normal",
        due: null,
        timebox: null,
        reminders: [],
    };
    assert.deepEqual(validateScheduledItemFormData(data), {
        valid: false,
        field: "objectReferences",
        message: "Object References are out of sync with the description.",
    });
    data.objectReferences = [{ label: "Ana", vaultPath: "People/Ana.md" }];
    assert.deepEqual(validateScheduledItemFormData(data), {
        valid: false,
        field: "detailNote",
        message: "Detail Note must use a vault-root Markdown path.",
    });
});
