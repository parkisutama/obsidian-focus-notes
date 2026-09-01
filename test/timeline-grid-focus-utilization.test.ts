import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Timeline blocks render a planned-versus-actual focus fill and surface it in the tooltip", async () => {
    const source = await readFile(new URL("../src/features/timeline/ui/TimelineGrid.ts", import.meta.url), "utf8");
    assert.match(source, /block\.utilization/);
    assert.match(source, /utilization: FocusUtilizationSummary/);
    assert.match(source, /if \(utilization\.sessionCount > 0 && heightPx >= 34\)/);
    assert.match(source, /createDiv\(\{ cls: "ftl-block-focus-fill" \}\)/);
    assert.match(source, /Focused: \$\{formatMinutes\(utilization\.focusedSeconds\)\} of \$\{formatMinutes\(utilization\.plannedSeconds\)\} planned/);
});

test("Timeline block tooltips clearly say Planned, and clicking a block passes its exact planned segment", async () => {
    const source = await readFile(new URL("../src/features/timeline/ui/TimelineGrid.ts", import.meta.url), "utf8");
    assert.match(source, /Planned: \$\{formatTime\(start\)\} – \$\{formatTime\(end\)\}/);
    assert.match(source, /onOpenItem\(item, \{ kind: "planned", start, end \}\)/);
});

test("clicking a Focus Session passes its exact focused segment, labeled distinctly from planned", async () => {
    const source = await readFile(new URL("../src/features/timeline/ui/TimelineGrid.ts", import.meta.url), "utf8");
    assert.match(source, /onOpenItem\(item, \{ kind: "focused", start: session\.start, end: session\.end \}\)/);
});

test("Timeline renders each actual Focus Session as its own solid segment, independent of any Timebox pairing", async () => {
    const source = await readFile(new URL("../src/features/timeline/ui/TimelineGrid.ts", import.meta.url), "utf8");
    assert.match(source, /layout\.sessions\.filter\(\(s\) => s\.dayKey === dayKey\)/);
    assert.match(source, /renderSession\(/);
    assert.match(source, /cls: `ftl-session/);
    assert.match(source, /itemById\.get\(itemKey\(session\.itemId, null\)\)/);
});
