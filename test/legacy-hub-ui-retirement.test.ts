import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { captureLedgerRecord } from "../src/LedgerRecordSource.ts";
import { buildScheduledItemFormBlockEdit, hydrateScheduledItemFormEdit } from "../src/ScheduledItemFormAdapter.ts";
import { replaceScheduledItemBlock } from "../src/ScheduledItemBlockEditor.ts";

test("active desktop and mobile capture shells do not render legacy Related Note controls", async () => {
    const [desktop, mobile] = await Promise.all([
        readFile(new URL("../src/EventTaskModal.ts", import.meta.url), "utf8"),
        readFile(new URL("../src/EventTaskMobileScreen.ts", import.meta.url), "utf8"),
    ]);

    assert.doesNotMatch(desktop, /renderHubNote\(/);
    assert.doesNotMatch(mobile, /renderRelatedNote\(/);
});

test("editing a legacy hub-linked Task does not migrate or rewrite unchanged Markdown", () => {
    const rawLine = "- [ ] [Prepare report](Legacy/Project%20Hub.md) | owner:Ana | priority:high";
    const content = `${rawLine}\n    - Historical hub-created description\n    - [ ] Preserve nested task`;
    const captured = captureLedgerRecord(content, { filePath: "Tasks.md", lineNumber: 1, rawLine });
    assert.equal(captured.status, "captured");
    if (captured.status !== "captured") return;

    const hydrated = hydrateScheduledItemFormEdit({
        kind: "task",
        title: "Prepare report",
        snapshot: captured.snapshot,
    });
    assert.equal(hydrated.status, "ready");
    if (hydrated.status !== "ready") return;
    const built = buildScheduledItemFormBlockEdit(hydrated.data, captured.snapshot);
    assert.equal(built.status, "ready");
    if (built.status !== "ready") return;

    assert.deepEqual(replaceScheduledItemBlock(content, captured.snapshot, built.edit), { status: "ready", content });
});
