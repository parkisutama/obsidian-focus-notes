import assert from "node:assert/strict";
import test from "node:test";
import type { App } from "obsidian";
import { captureTaskLedgerEdit, saveTaskLedgerEdit } from "../src/TaskLedgerEditor.ts";

function fakeApp(initialContent: string): {
    app: App;
    files: Map<string, string>;
    processCalls: string[];
} {
    const files = new Map([["Daily/2026-08-15.md", initialContent]]);
    const processCalls: string[] = [];
    const app = {
        vault: {
            getAbstractFileByPath: (path: string) => (files.has(path) ? { path, extension: "md", stat: {} } : null),
            read: async (file: { path: string }) => files.get(file.path) ?? "",
            process: async (file: { path: string }, update: (content: string) => string) => {
                processCalls.push(file.path);
                const current = files.get(file.path) ?? "";
                files.set(file.path, update(current));
            },
        },
    } as unknown as App;
    return { app, files, processCalls };
}

const original = [
    "## Activities & Tasks",
    "- [ ] [[Proposal|Review proposal]] | owner:Ana | due:2026-08-16",
    "    - Preserve this detail",
].join("\n");

const source = {
    filePath: "Daily/2026-08-15.md",
    lineNumber: 2,
    rawLine: "- [ ] [[Proposal|Review proposal]] | owner:Ana | due:2026-08-16",
};

test("captures then atomically saves only the owned Task fields", async () => {
    const { app, files, processCalls } = fakeApp(original);
    const captured = await captureTaskLedgerEdit(app, source);
    assert.equal(captured.status, "captured");
    if (captured.status !== "captured") return;

    const saved = await saveTaskLedgerEdit(app, captured.snapshot, {
        completed: true,
        priority: "high",
        due: "2026-08-17",
        timebox: null,
        reminders: [],
    });

    assert.deepEqual(saved, { status: "saved" });
    assert.deepEqual(processCalls, [source.filePath]);
    assert.equal(
        files.get(source.filePath),
        [
            "## Activities & Tasks",
            "- [x] [[Proposal|Review proposal]] | owner:Ana | due:2026-08-17 | priority:high",
            "    - Preserve this detail",
        ].join("\n"),
    );
});

test("returns unchanged without rewriting a semantic no-op", async () => {
    const { app, files } = fakeApp(original);
    const captured = await captureTaskLedgerEdit(app, source);
    assert.equal(captured.status, "captured");
    if (captured.status !== "captured") return;

    const saved = await saveTaskLedgerEdit(app, captured.snapshot, {
        completed: false,
        priority: "normal",
        due: "2026-08-16",
        timebox: null,
        reminders: [],
    });

    assert.deepEqual(saved, { status: "unchanged" });
    assert.equal(files.get(source.filePath), original);
});

test("refuses concurrent source changes and a missing or renamed file", async () => {
    const { app, files } = fakeApp(original);
    const captured = await captureTaskLedgerEdit(app, source);
    assert.equal(captured.status, "captured");
    if (captured.status !== "captured") return;

    files.set(source.filePath, original.replace("owner:Ana", "owner:Budi"));
    const conflicted = await saveTaskLedgerEdit(app, captured.snapshot, {
        completed: true,
        priority: "normal",
        due: "2026-08-16",
        timebox: null,
        reminders: [],
    });
    assert.deepEqual(conflicted, { status: "conflict", reason: "line-changed" });
    assert.match(files.get(source.filePath) ?? "", /owner:Budi/);

    files.delete(source.filePath);
    const missing = await saveTaskLedgerEdit(app, captured.snapshot, {
        completed: true,
        priority: "normal",
        due: null,
        timebox: null,
        reminders: [],
    });
    assert.deepEqual(missing, { status: "conflict", reason: "file-missing" });
});
