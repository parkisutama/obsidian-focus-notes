import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the plugin registers modify and file-open watchers that drive required-property auto-repair", async () => {
    const source = await readFile(new URL("../src/plugin/FocusNotesPlugin.ts", import.meta.url), "utf8");
    assert.match(
        source,
        /import \{ RequiredPropertyRepairWatcher \} from "\.\.\/infrastructure\/obsidian\/object-notes\/RequiredPropertyRepairWatcher\.ts";/,
    );
    assert.match(
        source,
        /const requiredPropertyRepairWatcher = new RequiredPropertyRepairWatcher\(\s*this\.app,\s*\(\) => this\.settings\.inbox\.contextSources,\s*new WriteSuppressionTracker\(\),\s*\);/,
    );
    assert.match(
        source,
        /this\.app\.vault\.on\("modify", \(file\) => \{\s*if \(file instanceof TFile\) void requiredPropertyRepairWatcher\.handleFile\(file\);/,
    );
    assert.match(
        source,
        /this\.app\.workspace\.on\("file-open", \(file\) => \{\s*if \(file instanceof TFile\) void requiredPropertyRepairWatcher\.handleFile\(file\);/,
    );
});
