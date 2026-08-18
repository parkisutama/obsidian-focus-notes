import assert from "node:assert/strict";
import test from "node:test";
import { resolveRelativeLinkDestination } from "../src/ContextLinkResolver.ts";
import { captureLedgerRecord } from "../src/LedgerRecordSource.ts";
import { retryScheduledItemEditRelated, submitScheduledItemEdit } from "../src/ScheduledItemEditSubmission.ts";
import type { ScheduledItemFormData } from "../src/ScheduledItemFormData.ts";

const contextSources = [
    {
        id: "people",
        name: "People",
        icon: "users",
        folders: ["People"],
        filter: null,
        relatedHeading: "Interactions",
        enabled: true,
    },
    {
        id: "places",
        name: "Places",
        icon: "map-pin",
        folders: ["Places"],
        filter: null,
        relatedHeading: "Mentions",
        enabled: true,
    },
];

function task(description: string): ScheduledItemFormData {
    const paths = [...description.matchAll(/@\{([^}]+)\}/g)].map((match) => ({
        label: match[1].split("/").at(-1)?.replace(/\.md$/, "") ?? "Object",
        vaultPath: match[1],
    }));
    return {
        kind: "task",
        title: "Review proposal",
        description,
        objectReferences: paths,
        detailNote: { mode: "none" },
        completed: false,
        priority: "normal",
        due: "2026-08-25",
        timebox: null,
        reminders: [],
    };
}

function snapshot() {
    const rawLine = "- [ ] Review proposal | due:2026-08-25";
    const captured = captureLedgerRecord(`${rawLine}\n    - Ask @{People/Ana.md}`, {
        filePath: "Tasks.md",
        lineNumber: 1,
        rawLine,
    });
    assert.equal(captured.status, "captured");
    if (captured.status !== "captured") throw new Error("fixture did not capture");
    return captured.snapshot;
}

test("writes the primary edit once and logs only newly resolved Object paths", async () => {
    let primaryWrites = 0;
    const relatedAttempts: string[] = [];
    const result = await submitScheduledItemEdit(
        task("Ask @{People/Ana.md}"),
        task("Ask @{People/Ana.md} at @{Places/Office.md} and @{Places/Office.md}"),
        snapshot(),
        {
            contextNotes: [{ path: "People/Ana.md" }, { path: "Places/Office.md" }],
            contextSources,
            now: new Date(2026, 7, 25, 8, 0),
            resolveLinkDestination: resolveRelativeLinkDestination,
            writePrimary: async () => {
                primaryWrites += 1;
            },
            writeRelated: async (request) => {
                relatedAttempts.push(request.destinationPath);
                throw new Error("locked");
            },
        },
    );

    assert.equal(primaryWrites, 1);
    assert.deepEqual(relatedAttempts, ["Places/Office.md"]);
    assert.equal(result.status, "partial");
    if (result.status !== "partial") return;

    const recovered = await retryScheduledItemEditRelated(result, async (request) => {
        relatedAttempts.push(request.destinationPath);
    });
    assert.equal(recovered.status, "success");
    assert.equal(primaryWrites, 1);
    assert.deepEqual(relatedAttempts, ["Places/Office.md", "Places/Office.md"]);
});

test("does not attempt related logs when the primary edit fails", async () => {
    let relatedWrites = 0;
    const result = await submitScheduledItemEdit(task(""), task("Ask @{People/Ana.md}"), snapshot(), {
        contextNotes: [{ path: "People/Ana.md" }],
        contextSources,
        resolveLinkDestination: resolveRelativeLinkDestination,
        writePrimary: async () => {
            throw new Error("stale snapshot");
        },
        writeRelated: async () => {
            relatedWrites += 1;
        },
    });

    assert.deepEqual(result, { status: "failure", phase: "primary", message: "Failed to save: stale snapshot" });
    assert.equal(relatedWrites, 0);
});
