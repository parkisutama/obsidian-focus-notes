import assert from "node:assert/strict";
import test from "node:test";
import type { App } from "obsidian";
import { isTFolder } from "../src/infrastructure/obsidian/vault/ObsidianFileTypes.ts";
import { ensureFolderPath } from "../src/infrastructure/obsidian/vault/VaultFolders.ts";

function createVaultApp(
    entries: Map<string, unknown>,
    created: string[],
    createFolder: (path: string) => Promise<void> = async (path) => {
        created.push(path);
        entries.set(path, { path, name: path.split("/").at(-1), children: [] });
    },
): App {
    return {
        vault: {
            getAbstractFileByPath: (path: string) => entries.get(path) ?? null,
            createFolder,
        },
    } as unknown as App;
}

test("isTFolder accepts vault folder-shaped values across runtime boundaries", () => {
    assert.equal(isTFolder({ path: "Notes", name: "Notes", children: [] }), true);
});

test("isTFolder rejects files and unrelated values", () => {
    assert.equal(isTFolder({ path: "Notes/item.md", name: "item.md", extension: "md", stat: {} }), false);
    assert.equal(isTFolder(null), false);
});

test("ensureFolderPath creates missing nested folders in parent-first order", async () => {
    const entries = new Map<string, unknown>();
    const created: string[] = [];

    await ensureFolderPath(createVaultApp(entries, created), "Projects/Focus/Notes");

    assert.deepEqual(created, ["Projects", "Projects/Focus", "Projects/Focus/Notes"]);
});

test("ensureFolderPath skips existing folders and empty or root paths", async () => {
    const entries = new Map<string, unknown>([["Projects", { path: "Projects", children: [] }]]);
    const created: string[] = [];
    const app = createVaultApp(entries, created);

    await ensureFolderPath(app, "");
    await ensureFolderPath(app, "/");
    await ensureFolderPath(app, "/Projects/Notes/");

    assert.deepEqual(created, ["Projects/Notes"]);
});

test("ensureFolderPath rejects a file encountered in the target path", async () => {
    const entries = new Map<string, unknown>([
        ["Projects", { path: "Projects", children: [] }],
        ["Projects/Focus", { path: "Projects/Focus", extension: "md", stat: {} }],
    ]);
    const created: string[] = [];

    await assert.rejects(
        ensureFolderPath(createVaultApp(entries, created), "Projects/Focus/Notes"),
        /Target folder path contains a file: Projects\/Focus/,
    );
    assert.deepEqual(created, []);
});

test("ensureFolderPath tolerates createFolder rejection from a concurrent creator", async () => {
    const entries = new Map<string, unknown>();
    const attempted: string[] = [];
    const app = createVaultApp(entries, attempted, async (path) => {
        attempted.push(path);
        throw new Error("already exists");
    });

    await ensureFolderPath(app, "Projects/Focus");

    assert.deepEqual(attempted, ["Projects", "Projects/Focus"]);
});

test("ensureFolderPath preserves dot segments instead of normalizing paths", async () => {
    const entries = new Map<string, unknown>();
    const created: string[] = [];

    await ensureFolderPath(createVaultApp(entries, created), "Projects/../Archive");

    assert.deepEqual(created, ["Projects", "Projects/..", "Projects/../Archive"]);
});
