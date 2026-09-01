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
        "    - description: Coordinate with @{People/Rachel.md}",
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
            reflection: { stressLevel: null, emotionCategory: null, emotionKey: null },
            reflectionNotes: null,
            timeboxes: [],
            lineEnding: "\n",
        },
    });
});

test("parses a Task's reflection notes as a separate field, excluded from description", () => {
    const rawBlock = [
        "- [x] Write the report | stress:low | emotion:pleasant | mood:calm",
        "    - description: Coordinate with @{People/Rachel.md}",
        "    - reflection-notes: Went smoothly, finished ahead of schedule.",
    ].join("\n");

    const parsed = parseScheduledItemBlock(rawBlock);
    assert.equal(parsed.status, "parsed");
    if (parsed.status !== "parsed") return;
    assert.equal(parsed.block.description, "Coordinate with @{People/Rachel.md}");
    assert.equal(parsed.block.reflectionNotes, "Went smoothly, finished ahead of schedule.");
});

test("omitting reflectionNotes from an edit leaves existing reflection notes untouched on disk", () => {
    const sourceLine = "- [ ] Prepare invoice";
    const content = [
        sourceLine,
        "    - description: Old description",
        "    - reflection-notes: Existing reflection.",
    ].join("\n");
    const captured = captureLedgerRecord(content, { filePath: "Tasks.md", lineNumber: 1, rawLine: sourceLine });
    assert.equal(captured.status, "captured");
    if (captured.status !== "captured") return;

    const result = replaceScheduledItemBlock(content, captured.snapshot, {
        firstLine: sourceLine,
        description: "New description",
        detailNote: { mode: "none" },
    });
    assert.equal(result.status, "ready");
    if (result.status !== "ready") return;
    assert.match(result.content, /- reflection-notes: Existing reflection\./);
    assert.match(result.content, /New description/);
});

test("an explicit reflectionNotes value replaces the existing notes line", () => {
    const sourceLine = "- [ ] Prepare invoice";
    const content = [sourceLine, "    - reflection-notes: Old reflection."].join("\n");
    const captured = captureLedgerRecord(content, { filePath: "Tasks.md", lineNumber: 1, rawLine: sourceLine });
    assert.equal(captured.status, "captured");
    if (captured.status !== "captured") return;

    const result = replaceScheduledItemBlock(content, captured.snapshot, {
        firstLine: sourceLine,
        description: "",
        detailNote: { mode: "none" },
        reflectionNotes: "Updated reflection.",
    });
    assert.equal(result.status, "ready");
    if (result.status !== "ready") return;
    assert.equal((result.content.match(/- reflection-notes:/g) ?? []).length, 1);
    assert.match(result.content, /- reflection-notes: Updated reflection\./);
    assert.doesNotMatch(result.content, /Old reflection/);
});

test("clearing reflectionNotes with an explicit empty string removes the notes line entirely", () => {
    const sourceLine = "- [ ] Prepare invoice";
    const content = [sourceLine, "    - reflection-notes: Old reflection."].join("\n");
    const captured = captureLedgerRecord(content, { filePath: "Tasks.md", lineNumber: 1, rawLine: sourceLine });
    assert.equal(captured.status, "captured");
    if (captured.status !== "captured") return;

    const result = replaceScheduledItemBlock(content, captured.snapshot, {
        firstLine: sourceLine,
        description: "",
        detailNote: { mode: "none" },
        reflectionNotes: "",
    });
    assert.equal(result.status, "ready");
    if (result.status !== "ready") return;
    assert.doesNotMatch(result.content, /notes:/);
});

test("rejects duplicate reflection-notes children", () => {
    const rawBlock = ["- [ ] Task", "    - reflection-notes: First.", "    - reflection-notes: Second."].join("\n");
    assert.deepEqual(parseScheduledItemBlock(rawBlock), { status: "invalid", reason: "duplicate-reflection-notes" });
});

test("normalizes a keyed description to one line and preserves unrelated nested bullets", () => {
    const rawBlock = [
        "- [ ] Prepare invoice | priority:high",
        "    - description: Dashboard yang memonitor kualitas data dan mendeteksi error",
        "    - [ ] Preserve this nested subtask",
        "        - nested note",
    ].join("\n");

    const parsed = parseScheduledItemBlock(rawBlock);
    assert.equal(parsed.status, "parsed");
    if (parsed.status !== "parsed") return;
    assert.equal(parsed.block.description, "Dashboard yang memonitor kualitas data dan mendeteksi error");

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
        "    - description: Old description",
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
            "    - description: First revised line Second revised line",
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
    const content = `${sourceLine}\n    - description: Keep text\n    - detail: [Keep title](Details/Keep%20title.md)\n    - [ ] Child`;
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
        "    - description: Description text",
        "    - timebox: start:2026-08-31 09:00 | end:2026-08-31 11:00 | status:planned ^timebox-aaaaaaaaaa",
        "    - timebox: start:2026-09-01 09:00 | end:2026-09-01 11:00 | status:completed ^timebox-bbbbbbbbbb",
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
        "    - timebox: start:2026-08-31 09:00 | end:2026-08-31 11:00 | status:planned ^timebox-aaaaaaaaaa",
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

test("editing a timebox preserves a direct sibling focus session", () => {
    const sourceLine = "- [ ] Prepare invoice";
    const content = [
        sourceLine,
        "    - timebox: start:2026-08-31 09:00 | end:2026-08-31 11:00 | status:planned ^timebox-aaaaaaaaaa",
        "    - focus-session: start:2026-08-31 09:12 | end:2026-08-31 09:37 | duration:25m | mode:pomodoro ^focus-aaaaaaaaaa",
        "    - timebox: start:2026-09-01 09:00 | end:2026-09-01 11:00 | status:planned ^timebox-bbbbbbbbbb",
    ].join("\n");
    const captured = captureLedgerRecord(content, { filePath: "Tasks.md", lineNumber: 1, rawLine: sourceLine });
    assert.equal(captured.status, "captured");
    if (captured.status !== "captured") return;

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
            "    - timebox: start:2026-08-31 10:00 | end:2026-08-31 12:00 | status:planned ^timebox-aaaaaaaaaa",
            "    - timebox: start:2026-09-01 09:00 | end:2026-09-01 11:00 | status:planned ^timebox-bbbbbbbbbb",
            "    - focus-session: start:2026-08-31 09:12 | end:2026-08-31 09:37 | duration:25m | mode:pomodoro ^focus-aaaaaaaaaa",
        ].join("\n"),
    );
});

test("deleting a timebox does not delete its independent sibling focus session", () => {
    const sourceLine = "- [ ] Prepare invoice";
    const content = [
        sourceLine,
        "    - timebox: start:2026-08-31 09:00 | end:2026-08-31 11:00 | status:planned ^timebox-aaaaaaaaaa",
        "    - focus-session: start:2026-08-31 09:12 | end:2026-08-31 09:37 | duration:25m | mode:pomodoro ^focus-aaaaaaaaaa",
        "    - timebox: start:2026-09-01 09:00 | end:2026-09-01 11:00 | status:planned ^timebox-bbbbbbbbbb",
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
    assert.match(result.content, /focus-aaaaaaaaaa/);
    assert.equal(
        result.content,
        [
            sourceLine,
            "    - timebox: start:2026-09-01 09:00 | end:2026-09-01 11:00 | status:planned ^timebox-bbbbbbbbbb",
            "    - focus-session: start:2026-08-31 09:12 | end:2026-08-31 09:37 | duration:25m | mode:pomodoro ^focus-aaaaaaaaaa",
        ].join("\n"),
    );
});

test("an Event's own direct-child focus-session line is excluded from description, not swallowed into it", () => {
    const sourceLine = "- Workshop | start:2026-09-01 09:00 | end:2026-09-01 12:00 ^event-abc1234567";
    const content = [
        sourceLine,
        "    - description: Bring the slides",
        "    - focus-session: start:2026-09-01 09:08 | end:2026-09-01 10:02 | duration:54m | mode:stopwatch ^focus-aaaaaaaaaa",
        "        - reflection-notes: Good energy today.",
    ].join("\n");

    const parsed = parseScheduledItemBlock(content);
    assert.equal(parsed.status, "parsed");
    if (parsed.status !== "parsed") return;
    assert.equal(parsed.block.description, "Bring the slides");
});

test("editing an Event's description leaves its own focus-session history and notes untouched on disk", () => {
    const sourceLine = "- Workshop | start:2026-09-01 09:00 | end:2026-09-01 12:00 ^event-abc1234567";
    const content = [
        sourceLine,
        "    - description: Bring the slides",
        "    - focus-session: start:2026-09-01 09:08 | end:2026-09-01 10:02 | duration:54m | mode:stopwatch ^focus-aaaaaaaaaa",
        "        - reflection-notes: Good energy today.",
    ].join("\n");
    const captured = captureLedgerRecord(content, { filePath: "Events.md", lineNumber: 1, rawLine: sourceLine });
    assert.equal(captured.status, "captured");
    if (captured.status !== "captured") return;

    const result = replaceScheduledItemBlock(content, captured.snapshot, {
        firstLine: sourceLine,
        description: "Bring the slides and handouts",
        detailNote: { mode: "none" },
    });
    assert.equal(result.status, "ready");
    if (result.status !== "ready") return;
    assert.match(
        result.content,
        /focus-session: start:2026-09-01 09:08 \| end:2026-09-01 10:02 \| duration:54m \| mode:stopwatch \^focus-aaaaaaaaaa/,
    );
    assert.match(result.content, /- reflection-notes: Good energy today\./);
    assert.match(result.content, /Bring the slides and handouts/);
});

test("rejects a malformed timebox line and duplicate timebox identities", () => {
    const sourceLine = "- [ ] Task";
    const malformed = `${sourceLine}\n    - timebox: start:2026-08-31 09:00 | end:2026-08-31 11:00`;
    assert.deepEqual(parseScheduledItemBlock(malformed), { status: "invalid", reason: "invalid-timebox-line" });

    const duplicateId = [
        sourceLine,
        "    - timebox: start:2026-08-31 09:00 | end:2026-08-31 11:00 | status:planned ^timebox-aaaaaaaaaa",
        "    - timebox: start:2026-09-01 09:00 | end:2026-09-01 11:00 | status:planned ^timebox-aaaaaaaaaa",
    ].join("\n");
    assert.deepEqual(parseScheduledItemBlock(duplicateId), { status: "invalid", reason: "duplicate-timebox-id" });
});

test("rejects duplicate detail children and stale, moved, or ambiguous snapshots", () => {
    const sourceLine = "- [ ] Task";
    const duplicate = `${sourceLine}\n    - detail: [One](One.md)\n    - detail: [Two](Two.md)`;
    assert.deepEqual(parseScheduledItemBlock(duplicate), { status: "invalid", reason: "duplicate-detail" });

    const original = `${sourceLine}\n    - description: Description`;
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
