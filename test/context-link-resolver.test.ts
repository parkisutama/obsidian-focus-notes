import assert from "node:assert/strict";
import test from "node:test";
import {
    addedResolvedMarkdownLinkPaths,
    type LinkDestinationResolver,
    resolveContextLinks,
    resolvedMarkdownLinkPaths,
    resolveRelativeLinkDestination,
} from "../src/ContextLinkResolver.ts";
import type { ContextSourceSettings } from "../src/types.ts";

const sources: ContextSourceSettings[] = [
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
    {
        id: "activities",
        name: "Activities",
        icon: "activity",
        folders: ["Persona/Work"],
        filter: { property: "type", value: "activity" },
        relatedHeading: "Logs",
        enabled: true,
    },
];

const notes = [
    { path: "People/Salma Saudah.md", properties: { aliases: ["Salma"] } },
    { path: "Places/Head Office.md" },
    { path: "Persona/Work/Projects/Audit/Activities/Field Review.md", properties: { type: "activity" } },
    { path: "Persona/Work/Projects/Audit/Tasks/Submit.md", properties: { type: "task" } },
    { path: "Books/Thinking.md", properties: { type: "book" } },
];

test("resolves aliases and encoded relative paths across varying folder depth", () => {
    const markdown = [
        "Meet [Salma](../../People/Salma%20Saudah.md)",
        "at [HQ](../../Places/Head%20Office.md)",
        "for [review](../../Persona/Work/Projects/Audit/Activities/Field%20Review.md)",
    ].join(" ");

    assert.deepEqual(
        resolveContextLinks(markdown, "Daily/2026/2026-08-02.md", notes, sources, resolveRelativeLinkDestination),
        [
            {
                filePath: "People/Salma Saudah.md",
                sourceId: "people",
                sourceName: "People",
                relatedHeading: "Interactions",
            },
            {
                filePath: "Places/Head Office.md",
                sourceId: "places",
                sourceName: "Places",
                relatedHeading: "Mentions",
            },
            {
                filePath: "Persona/Work/Projects/Audit/Activities/Field Review.md",
                sourceId: "activities",
                sourceName: "Activities",
                relatedHeading: "Logs",
            },
        ],
    );
});

test("deduplicates repeated destinations and ignores unrelated, filtered, and disabled links", () => {
    const markdown = [
        "[Salma](../People/Salma%20Saudah.md)",
        "[Salma again](../People/Salma%20Saudah.md)",
        "[task](../Persona/Work/Projects/Audit/Tasks/Submit.md)",
        "[book](../Books/Thinking.md)",
        "[office](../Places/Head%20Office.md)",
        "[web](https://example.com)",
    ].join(" ");
    const configured = sources.map((source) => (source.id === "places" ? { ...source, enabled: false } : source));

    assert.deepEqual(
        resolveContextLinks(markdown, "Daily/2026-08-02.md", notes, configured, resolveRelativeLinkDestination),
        [
            {
                filePath: "People/Salma Saudah.md",
                sourceId: "people",
                sourceName: "People",
                relatedHeading: "Interactions",
            },
        ],
    );
});

test("uses the most specific configured folder when sources overlap", () => {
    const broad = { ...sources[2], id: "work", name: "Work", folders: ["Persona"] };
    const specific = { ...sources[2], id: "audit", name: "Audit", folders: ["Persona/Work/Projects/Audit"] };

    assert.equal(
        resolveContextLinks(
            "[review](Persona/Work/Projects/Audit/Activities/Field%20Review.md)",
            "Daily.md",
            notes,
            [broad, specific],
            resolveRelativeLinkDestination,
        )[0]?.sourceId,
        "audit",
    );
});

test("uses property filters to distinguish object types sharing one folder", () => {
    const sharedSources: ContextSourceSettings[] = [
        {
            id: "objects",
            name: "Objects",
            icon: "folder",
            folders: ["Objects"],
            filter: null,
            relatedHeading: "Mentions",
            enabled: true,
        },
        {
            id: "projects",
            name: "Projects",
            icon: "briefcase",
            folders: ["Objects"],
            filter: { property: "type", value: "project" },
            relatedHeading: "Project log",
            enabled: true,
        },
        {
            id: "activities",
            name: "Activities",
            icon: "activity",
            folders: ["Objects"],
            filter: { property: "type", value: "activity" },
            relatedHeading: "Activity log",
            enabled: true,
        },
    ];
    const sharedNotes = [
        { path: "Objects/G2.md", properties: { type: "project" } },
        { path: "Objects/Cycling.md", properties: { type: "activity" } },
    ];

    assert.deepEqual(
        resolveContextLinks(
            "[G2](Objects/G2.md) [Cycling](Objects/Cycling.md)",
            "Daily.md",
            sharedNotes,
            sharedSources,
            resolveRelativeLinkDestination,
        ).map(({ filePath, sourceId }) => ({ filePath, sourceId })),
        [
            { filePath: "Objects/G2.md", sourceId: "projects" },
            { filePath: "Objects/Cycling.md", sourceId: "activities" },
        ],
    );
});

test("resolves a sibling folder note as a contextual destination", () => {
    const destinations = resolveContextLinks(
        "Visit [BLOK 05](../Projects/BLOK%2005.md)",
        "Daily/2026-08-03.md",
        [{ path: "Projects/BLOK 05.md", properties: { type: "place" } }],
        [
            {
                id: "places",
                name: "Places",
                icon: "map-pin",
                folders: ["Projects/BLOK 05"],
                filter: { property: "type", value: "place" },
                relatedHeading: "Related log",
                templatePath: "Templates/Place.md",
                enabled: true,
            },
        ],
        resolveRelativeLinkDestination,
    );

    assert.deepEqual(
        destinations.map((item) => item.filePath),
        ["Projects/BLOK 05.md"],
    );
});

test("resolves relative Markdown link destinations without filtering by note or source", () => {
    const markdown =
        "Reported by [Rachel](../../../people/Rachel%20Maelisa%20Damanik.md) about [BLOK F1](../../../persona/Karyawan%20IAT/BLOK%20F1/BLOK%20F1.md)";
    assert.deepEqual(
        resolvedMarkdownLinkPaths(markdown, "calendar/2026/2026-08/2026-08-06.md", resolveRelativeLinkDestination),
        ["people/Rachel Maelisa Damanik.md", "persona/Karyawan IAT/BLOK F1/BLOK F1.md"],
    );
});

test("deduplicates repeated relative Markdown link destinations", () => {
    const markdown = "[BLOK F1](../BLOK%20F1.md) mentioned twice: [again](../BLOK%20F1.md)";
    assert.deepEqual(resolvedMarkdownLinkPaths(markdown, "calendar/2026-08-06.md", resolveRelativeLinkDestination), [
        "BLOK F1.md",
    ]);
});

test("finds only newly added Markdown link destinations between two descriptions", () => {
    const original = "Found in [BLOK F1](../BLOK%20F1.md)";
    const next = "Found in [BLOK F1](../BLOK%20F1.md), reported by [Rachel](../people/Rachel.md)";
    assert.deepEqual(
        addedResolvedMarkdownLinkPaths(original, next, "calendar/2026-08-06.md", resolveRelativeLinkDestination),
        ["people/Rachel.md"],
    );
});

test("resolves Wikilinks through the injected resolver, honoring aliases and shortest-path targets", () => {
    const vaultFiles = new Map([
        ["BLOK F1", "persona/Karyawan IAT/BLOK F1/BLOK F1.md"],
        ["Rachel Maelisa Damanik", "people/Rachel Maelisa Damanik.md"],
    ]);
    const shortestPathResolver: LinkDestinationResolver = (rawTarget) => vaultFiles.get(rawTarget) ?? null;

    const markdown = "Reported by [[Rachel Maelisa Damanik|Rachel]] about [[BLOK F1]]";
    assert.deepEqual(resolvedMarkdownLinkPaths(markdown, "calendar/2026-08-06.md", shortestPathResolver), [
        "people/Rachel Maelisa Damanik.md",
        "persona/Karyawan IAT/BLOK F1/BLOK F1.md",
    ]);
});

test("ignores embeds and mixes Wikilinks with Markdown links in one description", () => {
    const vaultFiles = new Map([
        ["BLOK F1", "persona/BLOK F1.md"],
        ["diagram.png", "attachments/diagram.png"],
    ]);
    const resolver: LinkDestinationResolver = (rawTarget) => vaultFiles.get(rawTarget) ?? null;

    const markdown = "See [[BLOK F1]] and ![[diagram.png]] plus [BLOK F1 again](../persona/BLOK%20F1.md)";
    assert.deepEqual(resolvedMarkdownLinkPaths(markdown, "calendar/2026-08-06.md", resolver), ["persona/BLOK F1.md"]);
});
