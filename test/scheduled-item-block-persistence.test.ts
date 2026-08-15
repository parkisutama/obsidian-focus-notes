import assert from "node:assert/strict";
import test from "node:test";
import type { App } from "obsidian";
import { captureLedgerRecord } from "../src/LedgerRecordSource.ts";
import { saveScheduledItemBlock } from "../src/ScheduledItemBlockPersistence.ts";

function fakeApp(initial: string): { app: App; read: () => string } {
    let content = initial;
    const app = {
        vault: {
            getAbstractFileByPath: () => ({ path: "Tasks.md", extension: "md", stat: {} }),
            process: async (_file: unknown, update: (current: string) => string) => {
                content = update(content);
            },
        },
    } as unknown as App;
    return { app, read: () => content };
}

test("atomically saves a full Scheduled Item block while preserving unknown children", async () => {
    const rawLine = "- [ ] Task | owner:Ana";
    const initial = `${rawLine}\r\n    - Old description\r\n    - [ ] Keep child`;
    const captured = captureLedgerRecord(initial, { filePath: "Tasks.md", lineNumber: 1, rawLine });
    assert.equal(captured.status, "captured");
    if (captured.status !== "captured") return;
    const { app, read } = fakeApp(initial);

    assert.deepEqual(
        await saveScheduledItemBlock(app, captured.snapshot, {
            firstLine: "- [x] Task | owner:Ana | priority:high",
            description: "New description",
            detailNote: { mode: "link", title: "Task", path: "Details/Task.md" },
        }),
        { status: "saved" },
    );
    assert.equal(
        read(),
        "- [x] Task | owner:Ana | priority:high\r\n" +
            "    - New description\r\n    - detail: [Task](Details/Task.md)\r\n    - [ ] Keep child",
    );
});

test("returns a conflict without mutating externally changed content", async () => {
    const rawLine = "- [ ] Task";
    const captured = captureLedgerRecord(`${rawLine}\n    - Original`, {
        filePath: "Tasks.md",
        lineNumber: 1,
        rawLine,
    });
    assert.equal(captured.status, "captured");
    if (captured.status !== "captured") return;
    const { app, read } = fakeApp(`${rawLine}\n    - Changed elsewhere`);

    assert.deepEqual(
        await saveScheduledItemBlock(app, captured.snapshot, {
            firstLine: rawLine,
            description: "Mine",
            detailNote: { mode: "none" },
        }),
        { status: "conflict", reason: "block-changed" },
    );
    assert.equal(read(), `${rawLine}\n    - Changed elsewhere`);
});
