import assert from "node:assert/strict";
import test from "node:test";
import { resolveRelativeLinkDestination } from "../src/ContextLinkResolver.ts";
import { retryScheduledItemCreateRelated, writeScheduledItemCreateRelated } from "../src/ScheduledItemCreateRelated.ts";
import type { ScheduledItemFormData } from "../src/ScheduledItemFormData.ts";

const data: ScheduledItemFormData = {
    kind: "task",
    title: "Prepare invoice",
    description: "Ask @{People/Rachel.md} at @{Places/Office.md} and @Unresolved",
    objectReferences: [
        { label: "Rachel", vaultPath: "People/Rachel.md" },
        { label: "Office", vaultPath: "Places/Office.md" },
        { label: "Unresolved", vaultPath: null },
    ],
    detailNote: { mode: "none" },
    completed: false,
    priority: "normal",
    due: "2026-08-28",
    timebox: null,
    reminders: [],
};

const sources = [
    {
        id: "people",
        name: "People",
        icon: "users",
        folders: ["People"],
        filter: null,
        matchByFolder: true,
        matchByProperty: true,
        relatedHeading: "Interactions",
        enabled: true,
    },
    {
        id: "places",
        name: "Places",
        icon: "map-pin",
        folders: ["Places"],
        filter: null,
        matchByFolder: true,
        matchByProperty: true,
        relatedHeading: "Mentions",
        enabled: true,
    },
];

test("writes create related logs only for resolved configured Object paths", async () => {
    const attempts: string[] = [];
    const result = await writeScheduledItemCreateRelated(data, "Tasks.md", {
        contextNotes: [{ path: "People/Rachel.md" }, { path: "Places/Office.md" }],
        contextSources: sources,
        now: new Date(2026, 7, 28, 8, 0),
        resolveLinkDestination: resolveRelativeLinkDestination,
        writeRelated: async (request) => {
            attempts.push(request.destinationPath);
            if (request.destinationPath === "Places/Office.md") throw new Error("locked");
        },
    });

    assert.deepEqual(attempts, ["People/Rachel.md", "Places/Office.md"]);
    assert.equal(result.status, "partial");
    if (result.status !== "partial") return;
    const recovered = await retryScheduledItemCreateRelated(result, async (request) => {
        attempts.push(request.destinationPath);
    });
    assert.deepEqual(recovered, { status: "success", message: "Related logs saved." });
    assert.deepEqual(attempts, ["People/Rachel.md", "Places/Office.md", "Places/Office.md"]);
});
