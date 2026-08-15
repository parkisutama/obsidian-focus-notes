import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("mobile task and event edits route through one shared screen", async () => {
    const source = await readFile(new URL("../src/ScheduledItemEditor.ts", import.meta.url), "utf8");

    assert.match(source, /ScheduledItemMobileEditScreen/);
    assert.doesNotMatch(source, /openTaskEditForm/);
    assert.doesNotMatch(source, /openEventEditForm/);
});

test("mobile edit screen preserves detail and related-write recovery contracts", async () => {
    const source = await readFile(new URL("../src/ScheduledItemMobileEditScreen.ts", import.meta.url), "utf8");

    assert.match(source, /MobileScheduledItemForm/);
    assert.match(source, /promoteScheduledItemDetail/);
    assert.match(source, /retryDetailNoteAttachment/);
    assert.match(source, /submitScheduledItemEdit/);
    assert.match(source, /retryScheduledItemEditRelated/);
    assert.match(source, /saveScheduledItemBlock/);
});
