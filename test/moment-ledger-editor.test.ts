import assert from "node:assert/strict";
import test from "node:test";
import type { App } from "obsidian";
import { captureMomentEdit } from "../src/infrastructure/obsidian/capture/MomentLedgerEditor.ts";
import { saveMomentBlock } from "../src/infrastructure/obsidian/capture/MomentBlockPersistence.ts";

function fakeApp(initial: string) {
    const path = "Moments.md";
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

const rawLine = "- 2026-09-02 10:00 — Check in ^moment-aaaaaaaaaa";
const original = `${rawLine}\n    - description: Before\n    - custom: keep me`;

test("captures and atomically saves a Moment while preserving unknown nested Markdown", async () => {
    const { app, files, path } = fakeApp(original);
    const captured = await captureMomentEdit(app, { filePath: path, lineNumber: 1, rawLine });
    assert.equal(captured.status, "captured");
    if (captured.status !== "captured") return;
    assert.deepEqual(captured.block, {
        momentId: "moment-aaaaaaaaaa",
        heading: "2026-09-02 10:00 — Check in",
        description: "Before",
        reflection: { stressLevel: null, emotionCategory: null, emotionKey: null },
        reflectionNotes: null,
    });

    assert.deepEqual(
        await saveMomentBlock(app, captured.snapshot, {
            description: "After",
            reflection: { stressLevel: "high", emotionCategory: "unpleasant", emotionKey: "tense" },
            reflectionNotes: "Pause before continuing.",
        }),
        { status: "saved" },
    );
    assert.equal(
        files.get(path),
        `${rawLine}\n` +
            "    - description: After\n" +
            "    - reflection: stress:high | emotion:unpleasant | mood:tense\n" +
            "    - reflection-notes: Pause before continuing.\n" +
            "    - custom: keep me",
    );
});

test("refuses concurrent changes and a deleted or renamed source", async () => {
    const { app, files, path } = fakeApp(original);
    const captured = await captureMomentEdit(app, { filePath: path, lineNumber: 1, rawLine });
    assert.equal(captured.status, "captured");
    if (captured.status !== "captured") return;

    files.set(path, original.replace("keep me", "changed"));
    assert.deepEqual(
        await saveMomentBlock(app, captured.snapshot, {
            description: "After",
            reflection: { stressLevel: null, emotionCategory: null, emotionKey: null },
            reflectionNotes: null,
        }),
        { status: "conflict", reason: "block-changed" },
    );

    files.delete(path);
    assert.deepEqual(await captureMomentEdit(app, { filePath: path, lineNumber: 1, rawLine }), {
        status: "conflict",
        reason: "file-missing",
    });
});

test("reports an invalid block instead of saving over ambiguous content", async () => {
    const invalidRaw = "- 2026-09-02 10:00 — Check in ^moment-aaaaaaaaaa";
    const invalidContent = `${invalidRaw}\n    - description: One\n    - description: Two`;
    const { app, path } = fakeApp(invalidContent);
    assert.deepEqual(await captureMomentEdit(app, { filePath: path, lineNumber: 1, rawLine: invalidRaw }), {
        status: "invalid",
        reason: "duplicate-description",
    });
});
