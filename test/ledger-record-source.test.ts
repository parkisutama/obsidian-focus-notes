import assert from "node:assert/strict";
import test from "node:test";
import { captureLedgerRecord, replaceLedgerRecord } from "../src/LedgerRecordSource.ts";

const source = {
    filePath: "Daily/2026-08-15.md",
    lineNumber: 4,
    rawLine: "- [ ] Review proposal | due:2026-08-16 | owner:Ana",
};

test("captures a Task block with nested Markdown and preserves a no-op byte for byte", () => {
    const content = [
        "# Friday",
        "",
        "## Activities & Tasks",
        source.rawLine,
        "    - First detail",
        "",
        "        continuation with [[People/Ana|Ana]]",
        "",
        "- [ ] Another task | due:2026-08-17",
        "",
    ].join("\r\n");

    const captured = captureLedgerRecord(content, source);
    assert.equal(captured.status, "captured");
    if (captured.status !== "captured") return;

    assert.equal(
        captured.snapshot.rawBlock,
        [source.rawLine, "    - First detail", "", "        continuation with [[People/Ana|Ana]]"].join("\r\n"),
    );
    const replaced = replaceLedgerRecord(content, captured.snapshot, source.rawLine);
    assert.deepEqual(replaced, { status: "ready", content });
});

test("replaces only the owned first line while preserving nested content and line endings", () => {
    const content = `## Activities & Tasks\n${source.rawLine}\n    - Keep this description\n\nParagraph`;
    const captured = captureLedgerRecord(content, { ...source, lineNumber: 2 });
    assert.equal(captured.status, "captured");
    if (captured.status !== "captured") return;

    const replaced = replaceLedgerRecord(
        content,
        captured.snapshot,
        "- [x] Review proposal | priority:high | due:2026-08-16 | owner:Ana",
    );

    assert.deepEqual(replaced, {
        status: "ready",
        content:
            "## Activities & Tasks\n- [x] Review proposal | priority:high | due:2026-08-16 | owner:Ana\n" +
            "    - Keep this description\n\nParagraph",
    });
});

test("refuses stale, moved, deleted, and ambiguous source lines", () => {
    const original = `## Activities & Tasks\n${source.rawLine}\n    - Detail`;
    const captured = captureLedgerRecord(original, { ...source, lineNumber: 2 });
    assert.equal(captured.status, "captured");
    if (captured.status !== "captured") return;

    const changed = original.replace("Review proposal", "Review changed elsewhere");
    assert.deepEqual(replaceLedgerRecord(changed, captured.snapshot, source.rawLine), {
        status: "conflict",
        reason: "line-changed",
    });

    const moved = `Inserted\n${original}`;
    assert.deepEqual(replaceLedgerRecord(moved, captured.snapshot, source.rawLine), {
        status: "conflict",
        reason: "line-changed",
    });

    assert.deepEqual(replaceLedgerRecord("## Activities & Tasks", captured.snapshot, source.rawLine), {
        status: "conflict",
        reason: "line-missing",
    });

    const childChanged = original.replace("Detail", "Changed detail");
    assert.deepEqual(replaceLedgerRecord(childChanged, captured.snapshot, source.rawLine), {
        status: "conflict",
        reason: "block-changed",
    });

    const duplicated = `${original}\n\n${source.rawLine}\n    - Detail`;
    assert.deepEqual(replaceLedgerRecord(duplicated, captured.snapshot, source.rawLine), {
        status: "conflict",
        reason: "ambiguous",
    });
});
