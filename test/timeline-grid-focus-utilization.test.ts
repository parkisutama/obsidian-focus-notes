import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Timeline blocks render a planned-versus-actual focus fill and surface it in the tooltip", async () => {
    const source = await readFile(new URL("../src/features/timeline/ui/TimelineGrid.ts", import.meta.url), "utf8");
    assert.match(source, /block\.utilization/);
    assert.match(source, /utilization: FocusUtilizationSummary/);
    assert.match(source, /if \(utilization\.sessionCount > 0 && heightPx >= 34\)/);
    assert.match(source, /createDiv\(\{ cls: "ftl-block-focus-fill" \}\)/);
    assert.match(source, /focused of \$\{formatMinutes\(utilization\.plannedSeconds\)\} planned/);
});
