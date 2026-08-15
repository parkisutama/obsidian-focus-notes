import assert from "node:assert/strict";
import test from "node:test";
import { applyTaskFormatChanges } from "../src/TaskFormatWriter.ts";

test("applies multiple task formatting changes atomically while preserving CRLF", () => {
    const content = [
        "# Tasks",
        "- [ ] First | due:2026-08-20 | priority:high",
        "Unrelated",
        "- [x] Second | remind:2026-08-21 08:00 | priority:low",
        "",
    ].join("\r\n");

    const result = applyTaskFormatChanges(content, [
        {
            lineNumber: 2,
            rawLine: "- [ ] First | due:2026-08-20 | priority:high",
            normalizedLine: "- [ ] First | priority:high | due:2026-08-20",
        },
        {
            lineNumber: 4,
            rawLine: "- [x] Second | remind:2026-08-21 08:00 | priority:low",
            normalizedLine: "- [x] Second | priority:low | remind:2026-08-21 08:00",
        },
    ]);

    assert.equal(result.status, "ready");
    if (result.status === "ready") {
        assert.equal(
            result.content,
            [
                "# Tasks",
                "- [ ] First | priority:high | due:2026-08-20",
                "Unrelated",
                "- [x] Second | priority:low | remind:2026-08-21 08:00",
                "",
            ].join("\r\n"),
        );
    }
});

test("rejects the entire batch when any source line changed", () => {
    const content = "# Tasks\n- [ ] Changed\n- [ ] Stable | due:2026-08-20 | priority:high";
    const result = applyTaskFormatChanges(content, [
        { lineNumber: 2, rawLine: "- [ ] Original", normalizedLine: "- [ ] Original" },
        {
            lineNumber: 3,
            rawLine: "- [ ] Stable | due:2026-08-20 | priority:high",
            normalizedLine: "- [ ] Stable | priority:high | due:2026-08-20",
        },
    ]);

    assert.deepEqual(result, { status: "conflict", lineNumber: 2 });
    assert.equal(content.includes("priority:high | due"), false);
});

test("rejects duplicate line targets as ambiguous", () => {
    const result = applyTaskFormatChanges("- [ ] Task", [
        { lineNumber: 1, rawLine: "- [ ] Task", normalizedLine: "- [ ] Task" },
        { lineNumber: 1, rawLine: "- [ ] Task", normalizedLine: "- [ ] Task" },
    ]);
    assert.deepEqual(result, { status: "ambiguous", lineNumber: 1 });
});
