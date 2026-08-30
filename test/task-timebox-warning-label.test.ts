import assert from "node:assert/strict";
import test from "node:test";
import { describeTaskTimeboxWarnings } from "../src/features/capture/scheduled-item/domain/TaskTimeboxWarningLabel.ts";

test("describes no warnings as an empty string", () => {
    assert.equal(describeTaskTimeboxWarnings([]), "");
});

test("describes an overlap warning", () => {
    assert.equal(
        describeTaskTimeboxWarnings([{ type: "overlap", withTimeboxId: "timebox-a" }]),
        "Overlaps another timebox on this Task.",
    );
});

test("describes an after-due warning with the due date", () => {
    assert.equal(
        describeTaskTimeboxWarnings([{ type: "after-due", due: "2026-08-30" }]),
        "Scheduled after the Task's due date (2026-08-30).",
    );
});

test("joins multiple warnings into one sentence", () => {
    assert.equal(
        describeTaskTimeboxWarnings([
            { type: "overlap", withTimeboxId: "timebox-a" },
            { type: "after-due", due: "2026-08-30" },
        ]),
        "Overlaps another timebox on this Task. Scheduled after the Task's due date (2026-08-30).",
    );
});
