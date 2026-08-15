import assert from "node:assert/strict";
import test from "node:test";
import { inspectTaskLine, taskLineLintLabel } from "../src/TaskLineLint.ts";

test("distinguishes plain, canonical, and formatable task lines", () => {
    assert.deepEqual(inspectTaskLine("- [ ] Draft invoice"), {
        status: "plain",
        normalizedLine: "- [ ] Draft invoice",
        reason: null,
    });
    assert.deepEqual(inspectTaskLine("- [ ] Draft | priority:high | due:2026-08-20"), {
        status: "valid",
        normalizedLine: "- [ ] Draft | priority:high | due:2026-08-20",
        reason: null,
    });
    assert.deepEqual(inspectTaskLine("- [ ] Draft | due:2026-08-20 | priority:high"), {
        status: "needs-format",
        normalizedLine: "- [ ] Draft | priority:high | due:2026-08-20",
        reason: null,
    });
});

test("preserves unknown segments in place while ordering recognized keys", () => {
    const result = inspectTaskLine(
        "- [x] Draft | due:2026-08-20 | owner:Rachel | remind:2026-08-20 08:00 | priority:low",
    );

    assert.deepEqual(result, {
        status: "needs-format",
        normalizedLine: "- [x] Draft | priority:low | owner:Rachel | due:2026-08-20 | remind:2026-08-20 08:00",
        reason: null,
    });
});

test("reports invalid owned metadata without proposing a rewrite", () => {
    assert.deepEqual(inspectTaskLine("- [ ] Draft | due:tomorrow"), {
        status: "warning",
        normalizedLine: null,
        reason: "invalid-due",
    });
    assert.deepEqual(inspectTaskLine("- [ ] Draft | priority:high | priority:low"), {
        status: "warning",
        normalizedLine: null,
        reason: "duplicate-owned-field",
    });
});

test("provides concise user-facing lint labels", () => {
    assert.equal(taskLineLintLabel("plain"), "Plain");
    assert.equal(taskLineLintLabel("valid"), "Valid");
    assert.equal(taskLineLintLabel("needs-format"), "Needs format");
    assert.equal(taskLineLintLabel("warning"), "Warning");
});
