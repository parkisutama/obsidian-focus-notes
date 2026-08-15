import assert from "node:assert/strict";
import test from "node:test";
import { editEventLine, parseEventLineEdit } from "../src/EventLineEditor.ts";

test("keeps a valid Event no-op byte-identical with links and unknown metadata", () => {
    const line =
        "- 2026-08-20 09:00 - 10:30 [Review](Projects/Proposal.md) | owner:Ana | status:COMPLETED" +
        " | actual-start:2026-08-20 09:12 | actual-end:2026-08-20 10:18";
    const parsed = parseEventLineEdit(line);
    assert.equal(parsed.status, "parsed");
    if (parsed.status !== "parsed") return;

    assert.deepEqual(editEventLine(line, parsed.edit), { status: "ready", line });
});

test("updates planned and lifecycle fields while preserving unknown metadata", () => {
    const line =
        "- 2026-08-20 09:00 - 10:30 [[Proposal|Review]] | owner:Ana | status:completed" +
        " | actual-start:2026-08-20 09:12 | actual-end:2026-08-20 10:18 | custom:keep";

    assert.deepEqual(
        editEventLine(line, {
            allDay: false,
            start: "2026-08-21 13:00",
            end: "2026-08-21 14:30",
            status: "cancelled",
            actual: null,
        }),
        {
            status: "ready",
            line: "- 2026-08-21 13:00 - 14:30 [[Proposal|Review]] | owner:Ana | custom:keep | status:cancelled",
        },
    );
});

test("switches between timed and explicit all-day Event syntax", () => {
    const timed = "- 2026-08-20 09:00 - 10:30 Review | owner:Ana";
    const allDay = editEventLine(timed, {
        allDay: true,
        start: "2026-08-21",
        end: null,
        status: "planned",
        actual: null,
    });
    assert.deepEqual(allDay, {
        status: "ready",
        line: "- 2026-08-21 Review | owner:Ana | type:event | all-day:true",
    });
    if (allDay.status !== "ready") return;

    assert.deepEqual(
        editEventLine(allDay.line, {
            allDay: false,
            start: "2026-08-22 09:00",
            end: "2026-08-23 10:00",
            status: "planned",
            actual: null,
        }),
        {
            status: "ready",
            line: "- 2026-08-22 09:00 - 2026-08-23 10:00 Review | owner:Ana",
        },
    );
});

test("refuses ambiguous lifecycle metadata and invalid actual intervals", () => {
    assert.deepEqual(parseEventLineEdit("- 2026-08-20 09:00 - 10:00 Review | status:planned | status:cancelled"), {
        status: "invalid",
        reason: "duplicate-owned-field",
    });
    assert.deepEqual(
        parseEventLineEdit("- 2026-08-20 09:00 - 10:00 Review | status:completed | actual-start:2026-08-20 09:15"),
        { status: "invalid", reason: "incomplete-actual" },
    );
    assert.deepEqual(
        editEventLine("- 2026-08-20 09:00 - 10:00 Review", {
            allDay: false,
            start: "2026-08-20 11:00",
            end: "2026-08-20 10:00",
            status: "planned",
            actual: null,
        }),
        { status: "invalid", reason: "invalid-planned-interval" },
    );
});
