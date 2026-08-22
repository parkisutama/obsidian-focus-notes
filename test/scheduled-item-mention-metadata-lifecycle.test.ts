import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("scheduled mention index rebuilds after Obsidian resolves block metadata", async () => {
    const source = await readFile(new URL("../src/ObsidianInboxSuggestionSource.ts", import.meta.url), "utf8");

    assert.match(source, /metadataCache\.on\("resolved"/);
    assert.match(source, /getScheduledItemMentionSource\(this\.app\)[\s\S]*?\.rebuild\(\)/);
    assert.match(source, /\.then\(\(\) => this\.notifyScheduledItemsReady\(\)\)/);
});

test("scheduled mention rebuild ignores an older asynchronous index build", async () => {
    const source = await readFile(new URL("../src/ObsidianScheduledItemMentionSource.ts", import.meta.url), "utf8");

    assert.match(source, /private generation = 0/);
    assert.match(source, /if \(generation === this\.generation\)/);
});
