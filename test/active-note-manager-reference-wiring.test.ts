import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// ActiveNoteManagerModal extends Obsidian's Modal and ScheduledItemEditor drives real vault I/O,
// neither instantiable in node:test (see mobile-scheduled-item-create-composition.test.ts for the
// established pattern), so this characterizes the reference-aware wiring by source text.

test("opening a reference resolves its canonical block before editing, and reports orphan/ambiguous without editing", async () => {
    const source = await readFile(
        new URL("../src/features/capture/ui/ScheduledItemEditor.ts", import.meta.url),
        "utf8",
    );
    assert.match(
        source,
        /import \{[\s\S]*?resolveCanonicalScheduledItemSource,?[\s\S]*?\} from "\.\.\/\.\.\/\.\.\/infrastructure\/obsidian\/capture\/CanonicalScheduledItemResolver\.ts";/,
    );
    assert.match(source, /if \(item\.referenceTarget\) \{/);
    assert.match(
        source,
        /if \(resolved\.status !== "resolved"\) \{\s*new Notice\(referenceResolutionMessage\(resolved\.status\)\);\s*return;/,
    );
});

test("the Active Note Manager labels reference rows and never runs the Format fixer on them", async () => {
    const source = await readFile(
        new URL("../src/features/capture/scheduled-item/ui/ActiveNoteManagerModal.ts", import.meta.url),
        "utf8",
    );
    assert.match(
        source,
        /if \(item\.referenceTarget\) \{\s*titleRow\.createSpan\(\{\s*cls: "fn-active-note-manager-lint fn-active-note-manager-lint-reference",\s*text: "Reference",/,
    );
    assert.match(source, /if \(item\.referenceTarget\) return \[\];/);
});
