import assert from "node:assert/strict";
import test from "node:test";
import { buildTagSuggestions, ContextSuggestionIndex, InboxSuggestionSnapshot } from "../src/InboxSuggestions.ts";
import type { ContextSourceSettings } from "../src/types.ts";

const notes = [{ path: "Objects/Example.md", basename: "Example", aliases: [] }];

const contextNotes = [
    { path: "People/Ana.md", basename: "Ana", aliases: ["An"], properties: { type: "person" } },
    {
        path: "Persona/Work/Project/Activities/Reporting.md",
        basename: "Reporting",
        aliases: ["Monthly report"],
        properties: { type: "activity" },
    },
    {
        path: "Persona/Work/Project/Activities/Reference.md",
        basename: "Reference",
        aliases: [],
        properties: { type: "book" },
    },
];

test("indexes generic folder-scoped sources with optional property filters", () => {
    const sources: ContextSourceSettings[] = [
        {
            id: "people",
            name: "People",
            icon: "user",
            folders: ["People"],
            filter: null,
            matchByFolder: true,
            matchByProperty: true,
            relatedHeading: "Interactions",
            enabled: true,
        },
        {
            id: "activities",
            name: "Activities",
            icon: "activity",
            folders: ["Persona"],
            filter: { property: "type", value: "activity" },
            matchByFolder: true,
            matchByProperty: true,
            relatedHeading: "Activity log",
            enabled: true,
        },
    ];
    const index = new ContextSuggestionIndex(contextNotes);

    assert.deepEqual(
        index.query(sources, () => 0, 20).map((item) => [item.kind, item.sourceId, item.label, item.filePath]),
        [
            ["object", "people", "Ana", "People/Ana.md"],
            ["object", "people", "An", "People/Ana.md"],
            ["object", "activities", "Reporting", "Persona/Work/Project/Activities/Reporting.md"],
            ["object", "activities", "Monthly report", "Persona/Work/Project/Activities/Reporting.md"],
        ],
    );
});

test("keeps shared-folder suggestions assigned to their property-defined object type", () => {
    const sharedSources: ContextSourceSettings[] = [
        {
            id: "activities",
            name: "Activities",
            icon: "activity",
            folders: ["Persona/Work/Project/Activities"],
            filter: { property: "type", value: "activity" },
            matchByFolder: true,
            matchByProperty: true,
            relatedHeading: "Activity log",
            enabled: true,
        },
        {
            id: "books",
            name: "Books",
            icon: "book-open",
            folders: ["Persona/Work/Project/Activities"],
            filter: { property: "type", value: "book" },
            matchByFolder: true,
            matchByProperty: true,
            relatedHeading: "Reading log",
            enabled: true,
        },
    ];

    assert.deepEqual(
        new ContextSuggestionIndex(contextNotes)
            .query(sharedSources, () => 0)
            .filter(({ matchedBy }) => matchedBy === "filename")
            .map(({ sourceId, filePath }) => ({ sourceId, filePath })),
        [
            { sourceId: "activities", filePath: "Persona/Work/Project/Activities/Reporting.md" },
            { sourceId: "books", filePath: "Persona/Work/Project/Activities/Reference.md" },
        ],
    );
});

test("includes a sibling folder note with the same path as its configured folder", () => {
    const source: ContextSourceSettings = {
        id: "blocks",
        name: "Blocks",
        icon: "map",
        folders: ["Projects/BLOK 05"],
        filter: null,
        matchByFolder: true,
        matchByProperty: true,
        relatedHeading: "Related log",
        templatePath: "Templates/Block.md",
        enabled: true,
    };
    const index = new ContextSuggestionIndex([
        { path: "Projects/BLOK 05.md", basename: "BLOK 05", aliases: [] },
        { path: "Projects/BLOK 05/Inspection.md", basename: "Inspection", aliases: [] },
        { path: "Projects/BLOK 06.md", basename: "BLOK 06", aliases: [] },
    ]);

    assert.deepEqual(
        index.query([source], () => 0).map((item) => item.filePath),
        ["Projects/BLOK 05.md", "Projects/BLOK 05/Inspection.md"],
    );
});

test("caps and ranks generic results without rebuilding unchanged candidates", () => {
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
    const index = new ContextSuggestionIndex(contextNotes);

    const result = index.query([source], (text) => (text.includes("report") ? text.length : null), 1);

    assert.equal(result.length, 1);
    assert.equal(result[0]?.label, "Monthly report");
    assert.equal(index.candidateBuildCount, 1);
    index.query([source], () => 0, 20);
    assert.equal(index.candidateBuildCount, 1);
});

test("matches purely by property, vault-wide, when matchByFolder is off", () => {
    const source: ContextSourceSettings = {
        id: "activities",
        name: "Activities",
        icon: "activity",
        folders: [],
        filter: { property: "type", value: "activity" },
        matchByFolder: false,
        matchByProperty: true,
        relatedHeading: "Activity log",
        enabled: true,
    };
    const index = new ContextSuggestionIndex(contextNotes);

    assert.deepEqual(
        index
            .query([source], () => 0, 20)
            .filter(({ matchedBy }) => matchedBy === "filename")
            .map((item) => item.filePath),
        ["Persona/Work/Project/Activities/Reporting.md"],
    );
});

test("matches purely by folder, ignoring property, when matchByProperty is off", () => {
    const source: ContextSourceSettings = {
        id: "persona",
        name: "Persona",
        icon: "folder",
        folders: ["Persona"],
        filter: { property: "type", value: "activity" },
        matchByFolder: true,
        matchByProperty: false,
        relatedHeading: "Log",
        enabled: true,
    };
    const index = new ContextSuggestionIndex(contextNotes);

    assert.deepEqual(
        index
            .query([source], () => 0, 20)
            .filter(({ matchedBy }) => matchedBy === "filename")
            .map((item) => item.filePath)
            .sort(),
        ["Persona/Work/Project/Activities/Reference.md", "Persona/Work/Project/Activities/Reporting.md"],
    );
});

test("matches nothing when both matchByFolder and matchByProperty are off", () => {
    const source: ContextSourceSettings = {
        id: "inert",
        name: "Inert",
        icon: "circle",
        folders: ["Persona"],
        filter: { property: "type", value: "activity" },
        matchByFolder: false,
        matchByProperty: false,
        relatedHeading: "Log",
        enabled: true,
    };
    const index = new ContextSuggestionIndex(contextNotes);

    assert.deepEqual(
        index.query([source], () => 0, 20),
        [],
    );
});

test("normalizes and de-duplicates existing vault tags", () => {
    const results = buildTagSuggestions(["#follow-up", "idea", "#Follow-Up", "#project/work", ""], () => 0, 20);

    assert.deepEqual(results, ["#follow-up", "#idea", "#project/work"]);
});

test("fuzzy-filters tags and enforces the result limit", () => {
    const results = buildTagSuggestions(
        ["#follow-up", "#focus", "#food"],
        (text) => (text.includes("fo") ? text.length : null),
        2,
    );

    assert.deepEqual(results, ["#food", "#focus"]);
});

test("loads vault suggestion metadata only once per form", () => {
    let noteLoads = 0;
    let tagLoads = 0;
    const snapshot = new InboxSuggestionSnapshot(
        () => {
            noteLoads += 1;
            return notes;
        },
        () => {
            tagLoads += 1;
            return ["#focus"];
        },
    );

    assert.equal(snapshot.getNotes(), notes);
    assert.equal(snapshot.getNotes(), notes);
    assert.deepEqual(snapshot.getTags(), ["#focus"]);
    assert.deepEqual(snapshot.getTags(), ["#focus"]);
    assert.equal(noteLoads, 1);
    assert.equal(tagLoads, 1);
});

test("reloads cached metadata only after explicit invalidation", () => {
    let loads = 0;
    const snapshot = new InboxSuggestionSnapshot(
        () => {
            loads += 1;
            return notes;
        },
        () => [],
    );

    snapshot.getNotes();
    snapshot.getNotes();
    snapshot.invalidate();
    snapshot.getNotes();

    assert.equal(loads, 2);
});
