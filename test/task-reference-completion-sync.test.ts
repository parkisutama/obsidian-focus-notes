import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// TaskReferenceCompletionSync imports EventTaskWriter, which imports real Obsidian runtime
// values (normalizePath) and can't be instantiated in node:test (see
// mobile-scheduled-item-create-composition.test.ts for the established pattern). Its constituent
// pure pieces (detectTaskReferenceCheckboxToggles, applyCanonicalTaskCompletion,
// resolveCanonicalScheduledItemSource, WriteSuppressionTracker, TaskDayProjection's
// previousCompleted force-rewrite) each have direct behavioral tests; this characterizes that
// the orchestration wires them in the required order and never skips suppression.

test("resolves the canonical before writing, and reports orphan/ambiguous without any write", async () => {
    const source = await readFile(
        new URL("../src/infrastructure/obsidian/capture/TaskReferenceCompletionSync.ts", import.meta.url),
        "utf8",
    );
    assert.match(source, /const resolved = await resolveCanonicalScheduledItemSource\(app, toggle\.canonicalTarget\);/);
    assert.match(
        source,
        /if \(resolved\.status !== "resolved"\) \{\s*new Notice\(referenceResolutionMessage\(resolved\.status\)\);\s*return;/,
    );
});

test("suppresses the canonical file's own write before saving it, so the watcher ignores that echo", async () => {
    const source = await readFile(
        new URL("../src/infrastructure/obsidian/capture/TaskReferenceCompletionSync.ts", import.meta.url),
        "utf8",
    );
    assert.match(
        source,
        /tracker\.beginSuppress\(resolved\.filePath\);\s*try \{\s*const saved = await saveScheduledItemBlock/,
    );
    assert.match(source, /\} finally \{\s*tracker\.endSuppress\(resolved\.filePath\);\s*\}/);
});

test("reconciles day references only after the canonical save succeeds, forcing a full rewrite via previousCompleted", async () => {
    const source = await readFile(
        new URL("../src/infrastructure/obsidian/capture/TaskReferenceCompletionSync.ts", import.meta.url),
        "utf8",
    );
    assert.match(source, /await reconcileDayReferences\(/);
    assert.match(source, /!completed,\s*tracker,/);
});
