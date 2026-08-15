import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("mobile Task and Event creates route through the shared create screen", async () => {
    const source = await readFile(new URL("../src/EventTaskModal.ts", import.meta.url), "utf8");
    assert.match(source, /openMobileScheduledItemCreate/);
    assert.match(source, /initialKind === "task" \|\| options\.initialKind === "event"/);
});

test("mobile create screen preserves detail and related-write recovery", async () => {
    const source = await readFile(new URL("../src/ScheduledItemMobileCreateScreen.ts", import.meta.url), "utf8");
    assert.match(source, /MobileScheduledItemForm/);
    assert.match(source, /promoteScheduledItemDetail/);
    assert.match(source, /retryDetailNoteAttachment/);
    assert.match(source, /writeScheduledItemCreateRelated/);
    assert.match(source, /retryScheduledItemCreateRelated/);
});

test("Inbox mobile screen hands Task and Event choices to the shared create screen", async () => {
    const source = await readFile(new URL("../src/EventTaskMobileScreen.ts", import.meta.url), "utf8");
    assert.match(source, /openScheduledItemCreate\("event"\)/);
    assert.match(source, /openScheduledItemCreate\("task"\)/);
});
