import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Timer's Recent panel follows the active note instead of a resolved periodical target", async () => {
    const recentSource = await readFile(
        new URL("../src/features/focus-session/ui/TimerRecentEntries.ts", import.meta.url),
        "utf8",
    );
    assert.match(recentSource, /this\.app\.workspace\.getActiveFile\(\)/);
    assert.match(recentSource, /workspace\.on\("active-leaf-change", \(\) => void this\.refresh\(\)\)/);
    assert.doesNotMatch(recentSource, /TargetResolver/);
    assert.doesNotMatch(recentSource, /buildResolver/);

    const viewSource = await readFile(
        new URL("../src/features/focus-session/ui/TimerView.ts", import.meta.url),
        "utf8",
    );
    assert.doesNotMatch(viewSource, /TimerTargetEditor/);
    assert.match(
        viewSource,
        /new TimerRecentEntries\(this\.app, this, this\.getSettings, this\.buildReader\)/,
    );
});
