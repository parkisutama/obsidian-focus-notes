import assert from "node:assert/strict";
import test from "node:test";
import type { App } from "obsidian";
import {
    buildObjectNotePath,
    createObjectNote,
    expandObjectNoteTemplate,
    getCreatableObjectSources,
} from "../src/ObjectNote.ts";
import type { ContextSourceSettings } from "../src/types.ts";

test("builds a safe Object Note path inside a configured source folder", () => {
    assert.equal(buildObjectNotePath("Place", "Kantor: Jakarta/Utara", "flat"), "Place/Kantor_ Jakarta_Utara.md");
    assert.equal(buildObjectNotePath("Projects", "Blok G2", "folder-note"), "Projects/Blok G2/Blok G2.md");
    assert.equal(buildObjectNotePath("", "", "flat"), "Untitled.md");
});

test("creates an Object Note from its source template and enforces the source property", async () => {
    const files = new Map<string, unknown>();
    const template = { path: "Templates/Place.md", extension: "md", stat: {} };
    files.set(template.path, template);
    let createdContent = "";
    const frontmatter: Record<string, unknown> = {};
    const app = {
        vault: {
            getAbstractFileByPath: (path: string) => files.get(path) ?? null,
            read: async () => "---\naliases: []\n---\n# {{title}}",
            createFolder: async (path: string) => files.set(path, { path, children: [] }),
            create: async (path: string, content: string) => {
                createdContent = content;
                const file = { path, extension: "md", stat: {} };
                files.set(path, file);
                return file;
            },
        },
        fileManager: {
            processFrontMatter: async (_file: unknown, mutate: (value: Record<string, unknown>) => void) =>
                mutate(frontmatter),
        },
    } as unknown as App;
    const source: ContextSourceSettings = {
        id: "places",
        name: "Places",
        icon: "map-pin",
        folders: ["Objects/Places"],
        filter: { property: "type", value: "place" },
        relatedHeading: "Related log",
        templatePath: "Templates/Place.md",
        placement: "flat",
        enabled: true,
    };

    const created = await createObjectNote(app, source, {
        name: "Kantor Jakarta",
        folder: "Objects/Places",
        createdAt: new Date(2026, 7, 3, 14, 5),
        placement: "flat",
    });

    assert.equal(created.path, "Objects/Places/Kantor Jakarta.md");
    assert.equal(createdContent, "---\naliases: []\n---\n# Kantor Jakarta");
    assert.deepEqual(frontmatter, { type: "place" });
});

test("expands portable Object Note template tokens", () => {
    const createdAt = new Date(2026, 7, 3, 14, 5);
    assert.equal(
        expandObjectNoteTemplate("---\ntype: place\n---\n# {{title}}\ncreated: {{date}} {{time}}", "Kantor", createdAt),
        "---\ntype: place\n---\n# Kantor\ncreated: 2026-08-03 14:05",
    );
});

test("offers creation for enabled folder-scoped sources without requiring a template", () => {
    const base: ContextSourceSettings = {
        id: "places",
        name: "Places",
        icon: "map-pin",
        folders: ["Place"],
        filter: { property: "type", value: "place" },
        relatedHeading: "Related log",
        templatePath: "Templates/Place.md",
        placement: "flat",
        enabled: true,
    };
    assert.deepEqual(
        getCreatableObjectSources([
            base,
            { ...base, id: "disabled", enabled: false },
            { ...base, id: "folderless", folders: [] },
            { ...base, id: "template-less", templatePath: "" },
        ]).map((source) => source.id),
        ["places", "template-less"],
    );
});

test("creates a minimal typed Folder Note when no template is configured", async () => {
    const files = new Map<string, unknown>();
    let createdContent = "";
    const frontmatter: Record<string, unknown> = {};
    const app = {
        vault: {
            getAbstractFileByPath: (path: string) => files.get(path) ?? null,
            createFolder: async (path: string) => files.set(path, { path, children: [] }),
            create: async (path: string, content: string) => {
                createdContent = content;
                const file = { path, extension: "md", stat: {} };
                files.set(path, file);
                return file;
            },
        },
        fileManager: {
            processFrontMatter: async (_file: unknown, mutate: (value: Record<string, unknown>) => void) =>
                mutate(frontmatter),
        },
    } as unknown as App;
    const source: ContextSourceSettings = {
        id: "projects",
        name: "Projects",
        icon: "folder-kanban",
        folders: ["Notes"],
        filter: { property: "type", value: "project" },
        relatedHeading: "Related log",
        templatePath: "",
        placement: "folder-note",
        enabled: true,
    };

    const created = await createObjectNote(app, source, {
        name: "Blok G2",
        folder: "Notes",
        placement: "folder-note",
        createdAt: new Date(2026, 7, 3, 14, 5),
    });

    assert.equal(created.path, "Notes/Blok G2/Blok G2.md");
    assert.equal(createdContent, "# Blok G2\n");
    assert.deepEqual(frontmatter, { type: "project" });
});

test("allows an Object Note destination at any depth below a configured source root", async () => {
    const createdPaths: string[] = [];
    const app = {
        vault: {
            getAbstractFileByPath: () => null,
            createFolder: async () => {},
            create: async (path: string) => {
                createdPaths.push(path);
                return { path, extension: "md", stat: {} };
            },
        },
        fileManager: { processFrontMatter: async () => {} },
    } as unknown as App;
    const source: ContextSourceSettings = {
        id: "activities",
        name: "Activities",
        icon: "activity",
        folders: ["persona"],
        filter: { property: "type", value: "activity" },
        relatedHeading: "Activity log",
        templatePath: "",
        placement: "flat",
        enabled: true,
    };

    await createObjectNote(app, source, {
        name: "Field Review",
        folder: "persona/Karyawan/Projects/Blok G2/Activities",
        placement: "flat",
    });

    assert.deepEqual(createdPaths, ["persona/Karyawan/Projects/Blok G2/Activities/Field Review.md"]);
    await assert.rejects(
        createObjectNote(app, source, {
            name: "Outside",
            folder: "Archive",
            placement: "flat",
        }),
        /inside a configured source folder/,
    );
    await assert.rejects(
        createObjectNote(app, source, {
            name: "Traversal",
            folder: "persona/../Archive",
            placement: "flat",
        }),
        /invalid folder path/,
    );
});
