import assert from "node:assert/strict";
import test from "node:test";
import type { App } from "obsidian";
import { captureEventLedgerEdit, saveEventLedgerEdit } from "../src/EventLedgerEditor.ts";

function fakeApp(initial: string) {
    const path = "Daily/2026-08-20.md";
    const files = new Map([[path, initial]]);
    const processCalls: string[] = [];
    const app = {
        vault: {
            getAbstractFileByPath: (target: string) =>
                files.has(target) ? { path: target, extension: "md", stat: {} } : null,
            read: async (file: { path: string }) => files.get(file.path) ?? "",
            process: async (file: { path: string }, update: (content: string) => string) => {
                processCalls.push(file.path);
                files.set(file.path, update(files.get(file.path) ?? ""));
            },
        },
    } as unknown as App;
    return { app, files, path, processCalls };
}

const rawLine = "- 2026-08-20 09:00 - 10:30 [[Proposal|Review]] | owner:Ana";
const original = `## Activities & Tasks\n${rawLine}\n    - Preserve detail`;

test("captures and atomically saves an Event while preserving nested Markdown", async () => {
    const { app, files, path } = fakeApp(original);
    const captured = await captureEventLedgerEdit(app, { filePath: path, lineNumber: 2, rawLine });
    assert.equal(captured.status, "captured");
    if (captured.status !== "captured") return;
    assert.deepEqual(captured.edit, {
        allDay: false,
        start: "2026-08-20 09:00",
        end: "2026-08-20 10:30",
        status: "planned",
        actual: null,
    });

    assert.deepEqual(
        await saveEventLedgerEdit(app, captured.snapshot, {
            ...captured.edit,
            status: "completed",
            actual: { start: "2026-08-20 09:12", end: "2026-08-20 10:18" },
        }),
        { status: "saved" },
    );
    assert.equal(
        files.get(path),
        `${original.replace(rawLine, `${rawLine} | status:completed | actual-start:2026-08-20 09:12 | actual-end:2026-08-20 10:18`)}`,
    );
});

test("refuses invalid edits before processing the Vault file", async () => {
    const { app, path, processCalls } = fakeApp(original);
    const captured = await captureEventLedgerEdit(app, { filePath: path, lineNumber: 2, rawLine });
    assert.equal(captured.status, "captured");
    if (captured.status !== "captured") return;

    const result = await saveEventLedgerEdit(app, captured.snapshot, {
        ...captured.edit,
        start: "2026-08-20 11:00",
        end: "2026-08-20 10:00",
    });
    assert.deepEqual(result, { status: "invalid", reason: "invalid-planned-interval" });
    assert.deepEqual(processCalls, []);
});

test("refuses concurrent changes and a deleted or renamed source", async () => {
    const { app, files, path } = fakeApp(original);
    const captured = await captureEventLedgerEdit(app, { filePath: path, lineNumber: 2, rawLine });
    assert.equal(captured.status, "captured");
    if (captured.status !== "captured") return;

    files.set(path, original.replace("owner:Ana", "owner:Budi"));
    assert.deepEqual(await saveEventLedgerEdit(app, captured.snapshot, { ...captured.edit, status: "cancelled" }), {
        status: "conflict",
        reason: "line-changed",
    });
    assert.match(files.get(path) ?? "", /owner:Budi/);

    files.delete(path);
    assert.deepEqual(await saveEventLedgerEdit(app, captured.snapshot, captured.edit), {
        status: "conflict",
        reason: "file-missing",
    });
});
