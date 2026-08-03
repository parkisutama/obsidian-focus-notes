import assert from "node:assert/strict";
import test from "node:test";
import type { App } from "obsidian";
import { buildObjectNotePath, createObjectNote, expandObjectNoteTemplate } from "../src/ObjectNote.ts";
import type { ContextSourceSettings } from "../src/types.ts";

test("builds a safe Object Note path inside a configured source folder", () => {
    assert.equal(buildObjectNotePath("Place", "Kantor: Jakarta/Utara"), "Place/Kantor_ Jakarta_Utara.md");
    assert.equal(buildObjectNotePath("", ""), "Untitled.md");
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
        enabled: true,
    };

    const created = await createObjectNote(app, source, {
        name: "Kantor Jakarta",
        folder: "Objects/Places",
        createdAt: new Date(2026, 7, 3, 14, 5),
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
