import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("refreshes the Timeline when synced files or frontmatter metadata become available", async () => {
    const source = await readFile(new URL("../src/TimelineView.ts", import.meta.url), "utf8");

    assert.match(source, /this\.app\.metadataCache\.on\("resolved"/);
    assert.match(source, /this\.app\.metadataCache\.on\("changed"/);
    assert.match(source, /this\.app\.vault\.on\("create"/);
    assert.match(source, /this\.app\.vault\.on\("delete"/);
    assert.match(source, /this\.app\.vault\.on\("rename"/);
    assert.match(source, /scheduleIndexRefresh/);
});
