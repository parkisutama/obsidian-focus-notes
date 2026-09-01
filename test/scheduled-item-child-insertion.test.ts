import assert from "node:assert/strict";
import test from "node:test";
import { insertScheduledItemChildLine } from "../src/features/capture/scheduled-item/domain/ScheduledItemChildInsertion.ts";

test("inserts a canonical four-space child after all existing owner descendants", () => {
    const content = "- [ ] Report ^task-abc1234567\n    - description: Draft report\n- [ ] Other ^task-other";
    const result = insertScheduledItemChildLine(
        content,
        "task-abc1234567",
        (indent) => `${indent}- reflection-notes: Done`,
    );
    assert.deepEqual(result, {
        status: "inserted",
        content:
            "- [ ] Report ^task-abc1234567\n    - description: Draft report\n    - reflection-notes: Done\n- [ ] Other ^task-other",
    });
});

test("does not guess a missing owner", () => {
    assert.deepEqual(
        insertScheduledItemChildLine("- [ ] Report ^task-a", "task-b", () => "never"),
        { status: "anchor-not-found" },
    );
});
