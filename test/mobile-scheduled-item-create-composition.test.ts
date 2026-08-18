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

test("Task/Event create screens let the user switch kind without closing and reopening manually", async () => {
    const [desktopModal, mobileScreen, desktopForm, mobileForm] = await Promise.all([
        readFile(new URL("../src/ScheduledItemDesktopCreateModal.ts", import.meta.url), "utf8"),
        readFile(new URL("../src/ScheduledItemMobileCreateScreen.ts", import.meta.url), "utf8"),
        readFile(new URL("../src/DesktopScheduledItemForm.ts", import.meta.url), "utf8"),
        readFile(new URL("../src/MobileScheduledItemForm.ts", import.meta.url), "utf8"),
    ]);

    assert.match(desktopModal, /onSwitchKind:/);
    assert.match(desktopModal, /new EventTaskModal\(/);
    assert.match(desktopModal, /openDesktopScheduledItemCreate\(/);

    assert.match(mobileScreen, /onSwitchKind:/);
    assert.match(mobileScreen, /new EventTaskMobileScreen\(/);
    assert.match(mobileScreen, /openMobileScheduledItemCreate\(/);

    assert.match(desktopForm, /renderKindChips/);
    assert.match(mobileForm, /renderKindChips/);
});
