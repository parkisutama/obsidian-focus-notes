import assert from "node:assert/strict";
import test from "node:test";
import type { App } from "obsidian";
import { replaceMomentBlock } from "../src/features/capture/moment/domain/MomentBlockEditor.ts";
import { captureLedgerRecord } from "../src/features/capture/scheduled-item/domain/LedgerRecordSource.ts";
import { resolveCanonicalMomentSource } from "../src/infrastructure/obsidian/capture/CanonicalScheduledItemResolver.ts";

function snapshot(content: string) {
    const rawLine = content.split(/\r?\n/)[0] ?? "";
    const captured = captureLedgerRecord(content, { filePath: "Moments.md", lineNumber: 1, rawLine });
    assert.equal(captured.status, "captured");
    if (captured.status !== "captured") throw new Error("fixture did not capture");
    return captured.snapshot;
}

test("edits Moment-owned children in canonical order and preserves unknown nested Markdown", () => {
    const content =
        "- 2026-09-02 10:00 — Check in ^moment-aaaaaaaaaa\n" +
        "    - description: Before\n" +
        "    - custom: keep me\n" +
        "        - nested content\n";
    const result = replaceMomentBlock(content, snapshot(content), {
        description: "After",
        reflection: { stressLevel: "high", emotionCategory: "unpleasant", emotionKey: "tense" },
        reflectionNotes: "Pause before continuing.",
    });
    assert.deepEqual(result, {
        status: "ready",
        content:
            "- 2026-09-02 10:00 — Check in ^moment-aaaaaaaaaa\n" +
            "    - description: After\n" +
            "    - reflection: stress:high | emotion:unpleasant | mood:tense\n" +
            "    - reflection-notes: Pause before continuing.\n" +
            "    - custom: keep me\n" +
            "        - nested content\n",
    });
});

test("a semantic Moment no-op remains byte-identical", () => {
    const content = "- 10:00 ^moment-aaaaaaaaaa\r\n    - description: Same\r\n    - custom: untouched\r\n";
    const result = replaceMomentBlock(content, snapshot(content), {
        description: "Same",
        reflection: { stressLevel: null, emotionCategory: null, emotionKey: null },
        reflectionNotes: null,
    });
    assert.deepEqual(result, { status: "ready", content });
});

function appWith(files: Record<string, string>): App {
    return {
        vault: {
            getAbstractFileByPath: (path: string) => (path in files ? { path, extension: "md", stat: {} } : null),
            cachedRead: async (file: { path: string }) => files[file.path],
        },
    } as unknown as App;
}

test("Moment resolver accepts only an exact unique moment identity", async () => {
    const app = appWith({
        "Moments.md": "- 10:00 ^moment-aaaaaaaaaa\n- duplicate ^moment-aaaaaaaaaa\n- [ ] Task ^task-aaaaaaaaaa",
    });
    assert.deepEqual(await resolveCanonicalMomentSource(app, "Moments.md#^moment-aaaaaaaaaa"), {
        status: "ambiguous",
    });
    assert.deepEqual(await resolveCanonicalMomentSource(app, "Moments.md#^moment-bbbbbbbbbb"), { status: "orphan" });
    assert.deepEqual(await resolveCanonicalMomentSource(app, "Moments.md#^task-aaaaaaaaaa"), {
        status: "invalid-target",
    });
});
