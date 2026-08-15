import assert from "node:assert/strict";
import test from "node:test";
import { editTaskLine } from "../src/TaskLineEditor.ts";

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
