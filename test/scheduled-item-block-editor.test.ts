import assert from "node:assert/strict";
import test from "node:test";
import { captureLedgerRecord } from "../src/LedgerRecordSource.ts";
import { parseScheduledItemBlock, replaceScheduledItemBlock } from "../src/ScheduledItemBlockEditor.ts";

test("parses owned description and detail children while preserving unknown children", () => {
    const rawBlock = [
        "- [ ] Prepare invoice | priority:high",
        "    - Coordinate with @{People/Rachel.md}",
        "    - detail: [Invoice details](Tasks/Invoice%20details.md)",
        "    - [ ] Preserve this nested subtask",
        "        - nested note",
        "    > preserve quote",
    ].join("\n");

    assert.deepEqual(parseScheduledItemBlock(rawBlock), {
        status: "parsed",
        block: {
            firstLine: "- [ ] Prepare invoice | priority:high",
            description: "Coordinate with @{People/Rachel.md}",
            detailNote: { mode: "link", title: "Invoice details", path: "Tasks/Invoice details.md" },
            lineEnding: "\n",
        },
    });
});

test("replaces owned children without changing preserved content or CRLF", () => {
    const sourceLine = "- [ ] Prepare invoice | priority:high";
    const content = [
        "## Tasks",
        sourceLine,
        "    - Old description",
        "    - [ ] Preserve this nested subtask",
        "        - nested note",
        "    - detail: [Old title](Details/Old.md)",
        "    > preserve quote",
        "",
        "Paragraph",
    ].join("\r\n");
    const captured = captureLedgerRecord(content, { filePath: "Tasks.md", lineNumber: 2, rawLine: sourceLine });
    assert.equal(captured.status, "captured");
    if (captured.status !== "captured") return;

    const result = replaceScheduledItemBlock(content, captured.snapshot, {
        firstLine: "- [x] Prepare invoice | priority:medium",
        description: "First revised line\nSecond revised line",
        detailNote: { mode: "link", title: "Invoice", path: "Details/Invoice details.md" },
    });

    assert.deepEqual(result, {
        status: "ready",
        content: [
            "## Tasks",
            "- [x] Prepare invoice | priority:medium",
            "    - First revised line",
            "    - Second revised line",
            "    - detail: [Invoice](Details/Invoice%20details.md)",
            "    - [ ] Preserve this nested subtask",
            "        - nested note",
            "    > preserve quote",
            "",
            "Paragraph",
        ].join("\r\n"),
    });
});

test("preserves an unchanged owned block byte for byte", () => {
    const sourceLine = "- [ ] Legacy [linked title](Hub/Task.md) | owner:Ana";
    const content = `${sourceLine}\n    - Keep text\n    - detail: [Keep title](Details/Keep%20title.md)\n    - [ ] Child`;
    const captured = captureLedgerRecord(content, { filePath: "Tasks.md", lineNumber: 1, rawLine: sourceLine });
    assert.equal(captured.status, "captured");
    if (captured.status !== "captured") return;

    assert.deepEqual(
        replaceScheduledItemBlock(content, captured.snapshot, {
            firstLine: sourceLine,
            description: "Keep text",
            detailNote: { mode: "link", title: "Keep title", path: "Details/Keep title.md" },
        }),
        { status: "ready", content },
    );
});

test("rejects duplicate detail children and stale, moved, or ambiguous snapshots", () => {
    const sourceLine = "- [ ] Task";
    const duplicate = `${sourceLine}\n    - detail: [One](One.md)\n    - detail: [Two](Two.md)`;
    assert.deepEqual(parseScheduledItemBlock(duplicate), { status: "invalid", reason: "duplicate-detail" });

    const original = `${sourceLine}\n    - Description`;
    const captured = captureLedgerRecord(original, { filePath: "Tasks.md", lineNumber: 1, rawLine: sourceLine });
    assert.equal(captured.status, "captured");
    if (captured.status !== "captured") return;
    const edit = { firstLine: sourceLine, description: "Changed", detailNote: { mode: "none" } as const };

    assert.deepEqual(replaceScheduledItemBlock(`Inserted\n${original}`, captured.snapshot, edit), {
        status: "conflict",
        reason: "line-changed",
    });
    assert.deepEqual(replaceScheduledItemBlock(original.replace("Description", "External"), captured.snapshot, edit), {
        status: "conflict",
        reason: "block-changed",
    });
    assert.deepEqual(replaceScheduledItemBlock("# No task", captured.snapshot, edit), {
        status: "conflict",
        reason: "line-changed",
    });
    assert.deepEqual(replaceScheduledItemBlock(`${original}\n${original}`, captured.snapshot, edit), {
        status: "conflict",
        reason: "ambiguous",
    });
});
