import assert from "node:assert/strict";
import test from "node:test";
import {
    buildMentionSuggestions,
    buildTagSuggestions,
    filterMentionSuggestions
} from "../src/InboxSuggestions.ts";

const notes = [
    { path: "People/Muhammad Andi.md", basename: "Muhammad Andi", aliases: ["Andi", "Pak Andi"] },
    { path: "People/Clients/Sinta.md", basename: "Sinta", aliases: [] },
    { path: "Archive/People/Budi.md", basename: "Budi", aliases: [] },
    { path: "Place/Kantor.md", basename: "Kantor", aliases: ["HQ", "Andi"] },
    { path: "Travel/Jakarta.md", basename: "Jakarta", aliases: [] }
];

test("indexes recursive multi-root People and Place suggestions", () => {
    const suggestions = buildMentionSuggestions(
        notes,
        ["People"],
        ["Place", "Travel"]
    );

    assert.deepEqual(
        suggestions.map(item => [item.kind, item.label, item.filePath, item.matchedBy]),
        [
            ["person", "Muhammad Andi", "People/Muhammad Andi.md", "filename"],
            ["person", "Andi", "People/Muhammad Andi.md", "alias"],
            ["person", "Pak Andi", "People/Muhammad Andi.md", "alias"],
            ["person", "Sinta", "People/Clients/Sinta.md", "filename"],
            ["place", "Kantor", "Place/Kantor.md", "filename"],
            ["place", "HQ", "Place/Kantor.md", "alias"],
            ["place", "Andi", "Place/Kantor.md", "alias"],
            ["place", "Jakarta", "Travel/Jakarta.md", "filename"]
        ]
    );
});

test("keeps duplicate labels distinguishable by kind and path", () => {
    const suggestions = buildMentionSuggestions(notes, ["People"], ["Place"])
        .filter(item => item.label === "Andi");

    assert.deepEqual(suggestions.map(item => [item.kind, item.filePath]), [
        ["person", "People/Muhammad Andi.md"],
        ["place", "Place/Kantor.md"]
    ]);
});

test("returns no mention results for missing or empty source folders", () => {
    assert.deepEqual(buildMentionSuggestions(notes, ["Missing"], []), []);
});

test("filters and bounds mention results with the supplied fuzzy matcher", () => {
    const candidates = buildMentionSuggestions(notes, ["People"], ["Place", "Travel"]);
    const results = filterMentionSuggestions(
        candidates,
        text => text.toLowerCase().includes("ndi") ? text.length : null,
        2
    );

    assert.deepEqual(results.map(item => [item.label, item.kind]), [
        ["Andi", "person"],
        ["Andi", "place"]
    ]);
});

test("normalizes and de-duplicates existing vault tags", () => {
    const results = buildTagSuggestions(
        ["#follow-up", "idea", "#Follow-Up", "#project/work", ""],
        () => 0,
        20
    );

    assert.deepEqual(results, ["#follow-up", "#idea", "#project/work"]);
});

test("fuzzy-filters tags and enforces the result limit", () => {
    const results = buildTagSuggestions(
        ["#follow-up", "#focus", "#food"],
        text => text.includes("fo") ? text.length : null,
        2
    );

    assert.deepEqual(results, ["#food", "#focus"]);
});
