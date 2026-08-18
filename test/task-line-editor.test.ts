import assert from "node:assert/strict";
import test from "node:test";
import { editTaskLine, parseTaskLineEdit } from "../src/TaskLineEditor.ts";

test("parses every editable Task field including multiple reminders", () => {
    const line =
        "- [X] [[Proposal|Review proposal]] | owner:Ana | priority:medium | due:2026-08-17 17:00" +
        " | start:2026-08-17 09:00 | end:2026-08-17 11:00" +
        " | remind:2026-08-17 08:30 | remind:2026-08-17 16:30";

    assert.deepEqual(parseTaskLineEdit(line), {
        status: "parsed",
        edit: {
            completed: true,
            priority: "medium",
            due: "2026-08-17 17:00",
            timebox: { start: "2026-08-17 09:00", end: "2026-08-17 11:00" },
            reminders: ["2026-08-17 08:30", "2026-08-17 16:30"],
        },
    });
    assert.deepEqual(parseTaskLineEdit("- [ ] Task | owner:Ana"), {
        status: "parsed",
        edit: { completed: false, priority: "normal", due: null, timebox: null, reminders: [] },
    });
});

test("refuses ambiguous or malformed owned Task fields", () => {
    assert.deepEqual(parseTaskLineEdit("- [ ] Task | priority:high | priority:low"), {
        status: "invalid",
        reason: "duplicate-owned-field",
    });
    assert.deepEqual(parseTaskLineEdit("- [ ] Task | due:2026-02-30"), {
        status: "invalid",
        reason: "invalid-due",
    });
    assert.deepEqual(parseTaskLineEdit("- [ ] Task | start:2026-08-17 09:00"), {
        status: "invalid",
        reason: "incomplete-timebox",
    });
    assert.deepEqual(parseTaskLineEdit("- [ ] Task | start:2026-08-17 11:00 | end:2026-08-17 09:00"), {
        status: "invalid",
        reason: "invalid-timebox",
    });
    assert.deepEqual(parseTaskLineEdit("- [ ] Task | remind:tomorrow"), {
        status: "invalid",
        reason: "invalid-reminder",
    });
});

test("keeps a semantic no-op byte-identical, including title links and unknown metadata", () => {
    const line =
        "- [ ] [Review proposal](Projects/Proposal.md) | owner:Ana | priority:HIGH | due:2026-08-16 | custom:keep me";

    assert.deepEqual(
        editTaskLine(line, {
            completed: false,
            priority: "high",
            due: "2026-08-16",
            timebox: null,
            reminders: [],
        }),
        { status: "ready", line },
    );

    const explicitNormal = "- [ ] Routine | priority:normal | owner:Ana";
    assert.deepEqual(
        editTaskLine(explicitNormal, {
            completed: false,
            priority: "normal",
            due: null,
            timebox: null,
            reminders: [],
        }),
        { status: "ready", line: explicitNormal },
    );
});

test("updates owned Task attributes without rewriting unknown metadata or its order", () => {
    const line =
        "- [ ] [[Proposal|Review proposal]] | owner:Ana | due:2026-08-16 | x-plugin:value | remind:2026-08-16 08:00";

    assert.deepEqual(
        editTaskLine(line, {
            completed: true,
            priority: "medium",
            due: "2026-08-17 17:00",
            timebox: { start: "2026-08-17 09:00", end: "2026-08-17 11:00" },
            reminders: ["2026-08-17 08:30", "2026-08-17 16:30"],
        }),
        {
            status: "ready",
            line:
                "- [x] [[Proposal|Review proposal]] | owner:Ana | due:2026-08-17 17:00 | x-plugin:value" +
                " | remind:2026-08-17 08:30 | priority:medium | start:2026-08-17 09:00" +
                " | end:2026-08-17 11:00 | remind:2026-08-17 16:30",
        },
    );
});

test("normalizes out-of-order owned metadata into canonical order even without field changes", () => {
    const line = "- [ ] Task | due:2026-08-16 | owner:Ana | priority:high";

    assert.deepEqual(
        editTaskLine(line, {
            completed: false,
            priority: "high",
            due: "2026-08-16",
            timebox: null,
            reminders: [],
        }),
        { status: "ready", line: "- [ ] Task | priority:high | owner:Ana | due:2026-08-16" },
    );
});

test("removes optional owned attributes and refuses non-Task lines", () => {
    const line =
        "- [X] Task | owner:Ana | priority:low | due:2026-08-16 | start:2026-08-16 09:00 | end:2026-08-16 10:00 | remind:2026-08-16 08:00";

    assert.deepEqual(
        editTaskLine(line, {
            completed: false,
            priority: "normal",
            due: null,
            timebox: null,
            reminders: [],
        }),
        { status: "ready", line: "- [ ] Task | owner:Ana" },
    );
    assert.deepEqual(
        editTaskLine("- 2026-08-16 Event | type:event | all-day:true", {
            completed: false,
            priority: "normal",
            due: null,
            timebox: null,
            reminders: [],
        }),
        { status: "invalid", reason: "not-task" },
    );
});
