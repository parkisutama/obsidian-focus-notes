import assert from "node:assert/strict";
import test from "node:test";
import { createContextSource, findSharedFolderConflicts } from "../src/ContextSourceSettings.ts";
import { DEFAULT_SETTINGS, mergeSettingsWithDefaults } from "../src/types.ts";

test("migrates legacy People and Place folders and adds Activities", () => {
    const merged = mergeSettingsWithDefaults({
        inbox: {
            ...DEFAULT_SETTINGS.inbox,
            peopleFolders: ["CRM/People"],
            placeFolders: ["Atlas/Places"],
            contextSources: undefined as never,
        } as unknown as typeof DEFAULT_SETTINGS.inbox,
    });

    assert.deepEqual(
        merged.inbox.contextSources.map(({ id, folders }) => ({ id, folders })),
        [
            { id: "people", folders: ["CRM/People"] },
            { id: "places", folders: ["Atlas/Places"] },
            { id: "activities", folders: ["Activities"] },
        ],
    );
    assert.equal("peopleFolders" in merged.inbox, false);
    assert.equal("placeFolders" in merged.inbox, false);
});

test("normalizes duplicate IDs, invalid folders, and incomplete filters deterministically", () => {
    const source = {
        id: "My Source",
        name: "  Books  ",
        icon: "",
        folders: [" /Library/ ", "Library", "../unsafe"],
        filter: { property: " type ", value: " " },
        relatedHeading: " ",
        templatePath: "../unsafe.md",
        enabled: true,
    };
    const merged = mergeSettingsWithDefaults({
        inbox: { ...DEFAULT_SETTINGS.inbox, contextSources: [source, { ...source }] },
    });

    assert.deepEqual(merged.inbox.contextSources, [
        {
            id: "my-source",
            name: "Books",
            icon: "link",
            folders: ["Library"],
            filter: null,
            matchByFolder: true,
            matchByProperty: true,
            relatedHeading: "Related log",
            relatedPosition: "start",
            templatePath: "",
            placement: "flat",
            enabled: true,
            includeInTimeline: false,
        },
        {
            id: "my-source-2",
            name: "Books",
            icon: "link",
            folders: ["Library"],
            filter: null,
            matchByFolder: true,
            matchByProperty: true,
            relatedHeading: "Related log",
            relatedPosition: "start",
            templatePath: "",
            placement: "flat",
            enabled: true,
            includeInTimeline: false,
        },
    ]);
});

test("keeps an empty source list safe and no longer requires a folder to be enabled", () => {
    const empty = mergeSettingsWithDefaults({
        inbox: { ...DEFAULT_SETTINGS.inbox, contextSources: [] },
    });
    const folderless = mergeSettingsWithDefaults({
        inbox: {
            ...DEFAULT_SETTINGS.inbox,
            contextSources: [
                {
                    id: "book",
                    name: "Book",
                    icon: "book",
                    folders: [],
                    filter: null,
                    relatedHeading: "Mentions",
                    enabled: true,
                },
            ],
        },
    });

    assert.deepEqual(empty.inbox.contextSources, []);
    assert.equal(folderless.inbox.contextSources[0]?.enabled, true);
});

test("drops malformed values without throwing, leaving a source that matches nothing", () => {
    const merged = mergeSettingsWithDefaults({
        inbox: {
            ...DEFAULT_SETTINGS.inbox,
            contextSources: [
                {
                    id: 42,
                    name: null,
                    folders: [null, "../unsafe"],
                    enabled: true,
                    filter: { property: 1, value: [] },
                },
            ] as unknown as typeof DEFAULT_SETTINGS.inbox.contextSources,
        },
    });

    assert.deepEqual(merged.inbox.contextSources[0], {
        id: "source",
        name: "source",
        icon: "link",
        folders: [],
        filter: null,
        matchByFolder: true,
        matchByProperty: true,
        relatedHeading: "Related log",
        relatedPosition: "start",
        templatePath: "",
        placement: "flat",
        enabled: true,
        includeInTimeline: false,
    });
});

test("preserves a valid custom Book source and property filter", () => {
    const merged = mergeSettingsWithDefaults({
        inbox: {
            ...DEFAULT_SETTINGS.inbox,
            contextSources: [
                {
                    id: "books",
                    name: "Books",
                    icon: "book-open",
                    folders: ["Library/Books"],
                    filter: { property: "type", value: "book" },
                    relatedHeading: "Reading log",
                    templatePath: "Templates/Book.md",
                    enabled: true,
                },
            ],
        },
    });

    assert.deepEqual(merged.inbox.contextSources[0], {
        id: "books",
        name: "Books",
        icon: "book-open",
        folders: ["Library/Books"],
        filter: { property: "type", value: "book" },
        matchByFolder: true,
        matchByProperty: true,
        relatedHeading: "Reading log",
        relatedPosition: "start",
        templatePath: "Templates/Book.md",
        placement: "flat",
        enabled: true,
        includeInTimeline: false,
    });
});

test("creates a disabled object source with a stable unique ID", () => {
    const created = createContextSource([
        { ...DEFAULT_SETTINGS.inbox.contextSources[0], id: "source" },
        { ...DEFAULT_SETTINGS.inbox.contextSources[0], id: "source-2" },
    ]);

    assert.deepEqual(created, {
        id: "source-3",
        name: "New object",
        icon: "link",
        folders: [],
        filter: null,
        matchByFolder: true,
        matchByProperty: true,
        relatedHeading: "Related log",
        relatedPosition: "start",
        templatePath: "",
        placement: "flat",
        enabled: false,
        includeInTimeline: false,
    });
});

test("migrates temporal object types into Timeline while preserving an explicit opt-out", () => {
    const base = {
        icon: "activity",
        folders: ["persona"],
        relatedHeading: "Related log",
        enabled: true,
    };
    const merged = mergeSettingsWithDefaults({
        inbox: {
            ...DEFAULT_SETTINGS.inbox,
            contextSources: [
                {
                    ...base,
                    id: "projects",
                    name: "Projects",
                    filter: { property: "type", value: "project" },
                },
                {
                    ...base,
                    id: "activities",
                    name: "Activities",
                    filter: { property: "type", value: "activity" },
                    includeInTimeline: false,
                },
                {
                    ...base,
                    id: "books",
                    name: "Books",
                    filter: { property: "type", value: "book" },
                },
            ],
        },
    });

    assert.deepEqual(
        merged.inbox.contextSources.map(({ id, includeInTimeline }) => ({ id, includeInTimeline })),
        [
            { id: "projects", includeInTimeline: true },
            { id: "activities", includeInTimeline: false },
            { id: "books", includeInTimeline: false },
        ],
    );
});

test("allows a shared folder only when one property has distinct object values", () => {
    const base = {
        icon: "link",
        folders: ["Objects"],
        matchByFolder: true,
        matchByProperty: true,
        relatedHeading: "Related log",
        enabled: true,
    };
    const valid = [
        { ...base, id: "projects", name: "Projects", filter: { property: "type", value: "project" } },
        { ...base, id: "activities", name: "Activities", filter: { property: "type", value: "activity" } },
    ];
    const ambiguous = [valid[0], { ...base, id: "general", name: "General", filter: null }];

    assert.deepEqual(findSharedFolderConflicts(valid), new Map());
    assert.deepEqual(findSharedFolderConflicts(ambiguous), new Map([["Objects", ["projects", "general"]]]));
});

test("a source with matchByFolder off does not trigger folder-collision warnings", () => {
    const base = {
        icon: "link",
        folders: ["Objects"],
        matchByProperty: true,
        relatedHeading: "Related log",
        enabled: true,
        filter: null,
    };
    const sources = [
        { ...base, id: "projects", name: "Projects", matchByFolder: true },
        { ...base, id: "unscoped", name: "Unscoped", matchByFolder: false },
    ];

    assert.deepEqual(findSharedFolderConflicts(sources), new Map());
});

test("normalizeContextSources defaults matchByFolder/matchByProperty to true when unset", () => {
    const merged = mergeSettingsWithDefaults({
        inbox: {
            ...DEFAULT_SETTINGS.inbox,
            contextSources: [
                { id: "legacy", name: "Legacy", folders: ["Legacy"], filter: null, enabled: true },
                {
                    id: "explicit-off",
                    name: "Off",
                    folders: [],
                    matchByFolder: false,
                    matchByProperty: false,
                    enabled: true,
                },
            ],
        },
    });

    assert.equal(merged.inbox.contextSources[0]?.matchByFolder, true);
    assert.equal(merged.inbox.contextSources[0]?.matchByProperty, true);
    assert.equal(merged.inbox.contextSources[1]?.matchByFolder, false);
    assert.equal(merged.inbox.contextSources[1]?.matchByProperty, false);
});
