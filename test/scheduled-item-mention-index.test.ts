import assert from "node:assert/strict";
import test from "node:test";
import { ScheduledItemMentionIndex } from "../src/ScheduledItemMentionIndex.ts";

test("indexes only stable Task/Event blocks and queries within the selected kind", () => {
    const index = new ScheduledItemMentionIndex();
    index.replaceFile("Tasks.md", [
        {
            blockId: "task-7k3m9x2pqw",
            kind: "task",
            title: "Submit invoice",
            completed: false,
            status: "open",
            lineNumber: 2,
        },
        {
            blockId: "task-r4n8c2v6yz",
            kind: "task",
            title: "Archived invoice",
            completed: true,
            status: "completed",
            lineNumber: 3,
        },
        {
            blockId: "event-b5h7j3s9wx",
            kind: "event",
            title: "Invoice review",
            completed: false,
            status: "planned",
            lineNumber: 4,
        },
    ]);

    assert.deepEqual(
        index.query("task", (text) => (text.includes("invoice") ? text.length : null), 20).map((item) => item.blockId),
        ["task-7k3m9x2pqw", "task-r4n8c2v6yz"],
    );
    assert.deepEqual(
        index.query("event", () => 0, 20).map((item) => item.blockId),
        ["event-b5h7j3s9wx"],
    );
});

test("replaces and removes one file bucket without rebuilding unrelated candidates", () => {
    const index = new ScheduledItemMentionIndex();
    index.replaceFile("A.md", [
        { blockId: "task-7k3m9x2pqw", kind: "task", title: "A", completed: false, status: "open", lineNumber: 1 },
    ]);
    index.replaceFile("B.md", [
        { blockId: "task-r4n8c2v6yz", kind: "task", title: "B", completed: false, status: "open", lineNumber: 1 },
    ]);
    index.replaceFile("A.md", []);

    assert.deepEqual(
        index.query("task", () => 0).map((item) => item.filePath),
        ["B.md"],
    );
    index.removeFile("B.md");
    assert.deepEqual(
        index.query("task", () => 0),
        [],
    );
});

test("excludes duplicated block identities instead of linking ambiguously", () => {
    const index = new ScheduledItemMentionIndex();
    const duplicate = {
        blockId: "task-7k3m9x2pqw",
        kind: "task" as const,
        title: "Copied task",
        completed: false,
        status: "open" as const,
        lineNumber: 1,
    };
    index.replaceFile("A.md", [duplicate]);
    index.replaceFile("B.md", [duplicate]);

    assert.deepEqual(
        index.query("task", () => 0),
        [],
    );
});
