import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { ContextSuggestionIndex } from "../src/InboxSuggestions.ts";
import type { ContextSourceSettings } from "../src/types.ts";

test("records a bounded synthetic baseline and reuses warm candidates", () => {
    const notes = Array.from({ length: 10_000 }, (_, index) => ({
        path: `Persona/Work/Activities/Activity ${index}.md`,
        basename: `Activity ${index}`,
        aliases: [`Alias ${index}`],
        properties: { type: index % 2 === 0 ? "activity" : "reference" },
    }));
    const source: ContextSourceSettings = {
        id: "activities",
        name: "Activities",
        icon: "activity",
        folders: ["Persona"],
        filter: { property: "type", value: "activity" },
        matchByFolder: true,
        matchByProperty: true,
        relatedHeading: "Activity log",
        enabled: true,
    };
    const index = new ContextSuggestionIndex(notes);

    const coldStart = performance.now();
    const cold = index.query([source], (text) => (text.includes("4998") ? 0 : null), 20);
    const coldMs = performance.now() - coldStart;
    const warmStart = performance.now();
    const warm = index.query([source], () => 0, 20);
    const warmMs = performance.now() - warmStart;

    assert.equal(cold[0]?.label, "Activity 4998");
    assert.equal(warm.length, 20);
    assert.equal(index.candidateBuildCount, 1);
    assert.ok(coldMs < 5_000, `10k-note cold query took ${coldMs.toFixed(1)}ms`);
    assert.ok(warmMs < 1_000, `10k-note warm query took ${warmMs.toFixed(1)}ms`);
});
