import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("shared mobile renderer owns mobile lifecycle without importing desktop DOM", async () => {
    const source = await readFile(new URL("../src/MobileScheduledItemForm.ts", import.meta.url), "utf8");

    assert.match(source, /buildMobileScheduledItemFormModel/);
    assert.match(source, /ContextNotesController/);
    assert.match(source, /getMobileViewportMetrics/);
    assert.match(source, /workspace\.containerEl\.createDiv/);
    assert.doesNotMatch(source, /DesktopScheduledItemForm/);
});

test("shared mobile renderer exposes the complete portable form contract", async () => {
    const source = await readFile(new URL("../src/MobileScheduledItemForm.ts", import.meta.url), "utf8");

    for (const label of ["Title", "Priority", "Due", "Timebox", "Reminders", "Status", "Description", "Detail Note"])
        assert.match(source, new RegExp(`\\b${label}\\b`));
    assert.match(source, /referenceFormat:\s*"markdown-link"/);
    assert.match(source, /showCreateTarget/);
});
