import assert from "node:assert/strict";
import test from "node:test";
import { captureLedgerRecord } from "../src/features/capture/scheduled-item/domain/LedgerRecordSource.ts";
import {
    parseScheduledItemBlock,
    replaceScheduledItemBlock,
} from "../src/features/capture/scheduled-item/domain/ScheduledItemBlockEditor.ts";

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
            timeboxes: [],
            lineEnding: "\n",
        },
    });
});

test("keeps multi-level plain-bullet nesting connected to its parent description line", () => {
    const rawBlock = [
        "- [ ] Prepare invoice | priority:high",
        "    - Dashboard yang memonitor :",
        "        - kontrol kualitas data",
        "        - deteksi error di verifikasi",
        "    - [ ] Preserve this nested subtask",
        "        - nested note",
    ].join("\n");

    const parsed = parseScheduledItemBlock(rawBlock);
    assert.equal(parsed.status, "parsed");
    if (parsed.status !== "parsed") return;
    assert.equal(
        parsed.block.description,
        ["Dashboard yang memonitor :", "    - kontrol kualitas data", "    - deteksi error di verifikasi"].join("\n"),
    );

    const sourceLine = "- [ ] Prepare invoice | priority:high";
    const captured = captureLedgerRecord(rawBlock, { filePath: "Tasks.md", lineNumber: 1, rawLine: sourceLine });
    assert.equal(captured.status, "captured");
    if (captured.status !== "captured") return;

    const result = replaceScheduledItemBlock(rawBlock, captured.snapshot, {
        firstLine: sourceLine,
        description: parsed.block.description,
        detailNote: { mode: "none" },
    });
    assert.deepEqual(result, { status: "ready", content: rawBlock });
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

test("parses zero or many timebox children while leaving them untouched when the edit omits timeboxes", () => {
    const sourceLine = "- [ ] Prepare invoice";
    const content = [
        sourceLine,
        "    - Description text",
        "    - timebox | start:2026-08-31 09:00 | end:2026-08-31 11:00 | status:planned ^timebox-aaaaaaaaaa",
        "    - timebox | start:2026-09-01 09:00 | end:2026-09-01 11:00 | status:completed ^timebox-bbbbbbbbbb",
    ].join("\n");

    const parsed = parseScheduledItemBlock(content);
    assert.equal(parsed.status, "parsed");
    if (parsed.status !== "parsed") return;
    assert.deepEqual(parsed.block.timeboxes, [
        { timeboxId: "timebox-aaaaaaaaaa", start: "2026-08-31 09:00", end: "2026-08-31 11:00", status: "planned" },
        { timeboxId: "timebox-bbbbbbbbbb", start: "2026-09-01 09:00", end: "2026-09-01 11:00", status: "completed" },
    ]);

    const captured = captureLedgerRecord(content, { filePath: "Tasks.md", lineNumber: 1, rawLine: sourceLine });
    assert.equal(captured.status, "captured");
    if (captured.status !== "captured") return;

    // No `timeboxes` field on the edit means "leave them exactly as they are" — routine
    // description/detail edits from callers that predate Task 33 must not wipe timeboxes out.
    const result = replaceScheduledItemBlock(content, captured.snapshot, {
        firstLine: sourceLine,
        description: "Changed description",
        detailNote: { mode: "none" },
    });
    assert.equal(result.status, "ready");
    if (result.status !== "ready") return;
    assert.match(result.content, /timebox-aaaaaaaaaa/);
    assert.match(result.content, /timebox-bbbbbbbbbb/);
});

test("an explicit timeboxes array replaces every existing timebox child", () => {
    const sourceLine = "- [ ] Prepare invoice";
    const content = [
        sourceLine,
        "    - timebox | start:2026-08-31 09:00 | end:2026-08-31 11:00 | status:planned ^timebox-aaaaaaaaaa",
    ].join("\n");
    const captured = captureLedgerRecord(content, { filePath: "Tasks.md", lineNumber: 1, rawLine: sourceLine });
    assert.equal(captured.status, "captured");
    if (captured.status !== "captured") return;

    const result = replaceScheduledItemBlock(content, captured.snapshot, {
        firstLine: sourceLine,
        description: "",
        detailNote: { mode: "none" },
        timeboxes: [
            { timeboxId: "timebox-cccccccccc", start: "2026-09-05 09:00", end: "2026-09-05 10:00", status: "planned" },
        ],
    });
    assert.equal(result.status, "ready");
    if (result.status !== "ready") return;
    assert.doesNotMatch(result.content, /timebox-aaaaaaaaaa/);
    assert.match(result.content, /timebox-cccccccccc/);
});

test("editing one timebox keeps a nested focus-session line attached to its own timebox, not a sibling", () => {
    const sourceLine = "- [ ] Prepare invoice";
    const content = [
        sourceLine,
        "    - timebox | start:2026-08-31 09:00 | end:2026-08-31 11:00 | status:planned ^timebox-aaaaaaaaaa",
        "      - focus-session | start:2026-08-31 09:12 | end:2026-08-31 09:37 | duration:25m | mode:pomodoro ^focus-aaaaaaaaaa",
        "    - timebox | start:2026-09-01 09:00 | end:2026-09-01 11:00 | status:planned ^timebox-bbbbbbbbbb",
    ].join("\n");
    const captured = captureLedgerRecord(content, { filePath: "Tasks.md", lineNumber: 1, rawLine: sourceLine });
    assert.equal(captured.status, "captured");
    if (captured.status !== "captured") return;

    // Editing timebox A's interval (its id is unchanged) must not detach or reassign its
    // nested focus-session to timebox B, even though B's line physically moves up in the file.
    const result = replaceScheduledItemBlock(content, captured.snapshot, {
        firstLine: sourceLine,
        description: "",
        detailNote: { mode: "none" },
        timeboxes: [
            { timeboxId: "timebox-aaaaaaaaaa", start: "2026-08-31 10:00", end: "2026-08-31 12:00", status: "planned" },
            { timeboxId: "timebox-bbbbbbbbbb", start: "2026-09-01 09:00", end: "2026-09-01 11:00", status: "planned" },
        ],
    });
    assert.equal(result.status, "ready");
    if (result.status !== "ready") return;
    assert.equal(
        result.content,
        [
            sourceLine,
            "    - timebox | start:2026-08-31 10:00 | end:2026-08-31 12:00 | status:planned ^timebox-aaaaaaaaaa",
            "      - focus-session | start:2026-08-31 09:12 | end:2026-08-31 09:37 | duration:25m | mode:pomodoro ^focus-aaaaaaaaaa",
            "    - timebox | start:2026-09-01 09:00 | end:2026-09-01 11:00 | status:planned ^timebox-bbbbbbbbbb",
        ].join("\n"),
    );
});

test("deleting a timebox cleanly removes its nested focus-session line instead of leaving it dangling", () => {
    const sourceLine = "- [ ] Prepare invoice";
    const content = [
        sourceLine,
        "    - timebox | start:2026-08-31 09:00 | end:2026-08-31 11:00 | status:planned ^timebox-aaaaaaaaaa",
        "      - focus-session | start:2026-08-31 09:12 | end:2026-08-31 09:37 | duration:25m | mode:pomodoro ^focus-aaaaaaaaaa",
        "    - timebox | start:2026-09-01 09:00 | end:2026-09-01 11:00 | status:planned ^timebox-bbbbbbbbbb",
    ].join("\n");
    const captured = captureLedgerRecord(content, { filePath: "Tasks.md", lineNumber: 1, rawLine: sourceLine });
    assert.equal(captured.status, "captured");
    if (captured.status !== "captured") return;

    const result = replaceScheduledItemBlock(content, captured.snapshot, {
        firstLine: sourceLine,
        description: "",
        detailNote: { mode: "none" },
        timeboxes: [
            { timeboxId: "timebox-bbbbbbbbbb", start: "2026-09-01 09:00", end: "2026-09-01 11:00", status: "planned" },
        ],
    });
    assert.equal(result.status, "ready");
    if (result.status !== "ready") return;
    assert.doesNotMatch(result.content, /focus-aaaaaaaaaa/);
    assert.equal(
        result.content,
        [
            sourceLine,
            "    - timebox | start:2026-09-01 09:00 | end:2026-09-01 11:00 | status:planned ^timebox-bbbbbbbbbb",
        ].join("\n"),
    );
});

test("rejects a malformed timebox line and duplicate timebox identities", () => {
    const sourceLine = "- [ ] Task";
    const malformed = `${sourceLine}\n    - timebox | start:2026-08-31 09:00 | end:2026-08-31 11:00`;
    assert.deepEqual(parseScheduledItemBlock(malformed), { status: "invalid", reason: "invalid-timebox-line" });

    const duplicateId = [
        sourceLine,
        "    - timebox | start:2026-08-31 09:00 | end:2026-08-31 11:00 | status:planned ^timebox-aaaaaaaaaa",
        "    - timebox | start:2026-09-01 09:00 | end:2026-09-01 11:00 | status:planned ^timebox-aaaaaaaaaa",
    ].join("\n");
    assert.deepEqual(parseScheduledItemBlock(duplicateId), { status: "invalid", reason: "duplicate-timebox-id" });
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
