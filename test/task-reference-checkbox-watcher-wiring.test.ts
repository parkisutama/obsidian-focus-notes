import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the plugin registers a vault modify watcher that drives Task reference checkbox sync", async () => {
    const source = await readFile(new URL("../src/plugin/FocusNotesPlugin.ts", import.meta.url), "utf8");
    assert.match(
        source,
        /import \{ TaskReferenceCheckboxWatcher \} from "\.\.\/infrastructure\/obsidian\/capture\/TaskReferenceCheckboxWatcher\.ts";/,
    );
    assert.match(
        source,
        /const taskReferenceCheckboxWatcher = new TaskReferenceCheckboxWatcher\(this\.app, \(\) => this\.settings\);/,
    );
    assert.match(
        source,
        /this\.registerEvent\(\s*this\.app\.vault\.on\("modify", \(file\) => \{\s*if \(file instanceof TFile\) void taskReferenceCheckboxWatcher\.handleModify\(file\);/,
    );
});

test("the watcher ignores its own suppressed writes and only reprocesses genuine checkbox toggles", async () => {
    const source = await readFile(
        new URL("../src/infrastructure/obsidian/capture/TaskReferenceCheckboxWatcher.ts", import.meta.url),
        "utf8",
    );
    assert.match(source, /if \(this\.tracker\.isSuppressed\(path\)\) \{/);
    assert.match(source, /detectTaskReferenceCheckboxToggles\(previous, next\)/);
    assert.match(
        source,
        /await syncTaskReferenceCompletion\(this\.app, this\.getSettings\(\), toggle, this\.tracker\);/,
    );
});
