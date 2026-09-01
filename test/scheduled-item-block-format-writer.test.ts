import assert from "node:assert/strict";
import test from "node:test";
import type { App } from "obsidian";
import { saveScheduledItemBlockFormatChanges } from "../src/infrastructure/obsidian/capture/ScheduledItemBlockFormatWriter.ts";

function fakeApp(initial: string) {
    const path = "Tasks.md";
    const files = new Map([[path, initial]]);
    const app = {
        vault: {
            getAbstractFileByPath: (target: string) =>
                files.has(target) ? { path: target, extension: "md", stat: {} } : null,
            process: async (file: { path: string }, update: (content: string) => string) => {
                files.set(file.path, update(files.get(file.path) ?? ""));
            },
        },
    } as unknown as App;
    return { app, files, path };
}

test("saves every block format change in one write", async () => {
    const original = ["- [ ] Prepare invoice", "    - notes: Retrospective note."].join("\n");
    const { app, files, path } = fakeApp(original);

    const result = await saveScheduledItemBlockFormatChanges(app, path, [
        {
            lineNumber: 1,
            rawLine: "- [ ] Prepare invoice",
            normalizedBlock: "- [ ] Prepare invoice\n    - reflection-notes: Retrospective note.",
        },
    ]);
    assert.deepEqual(result, { status: "saved" });
    assert.equal(files.get(path), "- [ ] Prepare invoice\n    - reflection-notes: Retrospective note.");
});

test("reports unchanged without rewriting an already-canonical file", async () => {
    const original = "- [ ] Prepare invoice\n    - reflection-notes: Retrospective note.";
    const { app, path } = fakeApp(original);

    const result = await saveScheduledItemBlockFormatChanges(app, path, [
        {
            lineNumber: 1,
            rawLine: "- [ ] Prepare invoice",
            normalizedBlock: "- [ ] Prepare invoice\n    - reflection-notes: Retrospective note.",
        },
    ]);
    assert.deepEqual(result, { status: "unchanged" });
});

test("reports file-missing for a note that no longer exists", async () => {
    const { app } = fakeApp("- [ ] Prepare invoice");
    const result = await saveScheduledItemBlockFormatChanges(app, "Missing.md", []);
    assert.deepEqual(result, { status: "file-missing" });
});
