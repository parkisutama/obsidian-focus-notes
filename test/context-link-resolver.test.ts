import assert from "node:assert/strict";
import test from "node:test";
import { resolveContextLinks } from "../src/ContextLinkResolver.ts";
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

    assert.deepEqual(resolveContextLinks(markdown, "Daily/2026/2026-08-02.md", notes, sources), [
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
    ]);
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

    assert.deepEqual(resolveContextLinks(markdown, "Daily/2026-08-02.md", notes, configured), [
        {
            filePath: "People/Salma Saudah.md",
            sourceId: "people",
            sourceName: "People",
            relatedHeading: "Interactions",
        },
    ]);
});

test("uses the most specific configured folder when sources overlap", () => {
    const broad = { ...sources[2], id: "work", name: "Work", folders: ["Persona"] };
    const specific = { ...sources[2], id: "audit", name: "Audit", folders: ["Persona/Work/Projects/Audit"] };

    assert.equal(
        resolveContextLinks("[review](Persona/Work/Projects/Audit/Activities/Field%20Review.md)", "Daily.md", notes, [
            broad,
            specific,
        ])[0]?.sourceId,
        "audit",
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
    );

    assert.deepEqual(
        destinations.map((item) => item.filePath),
        ["Projects/BLOK 05.md"],
    );
});
