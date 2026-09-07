import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("desktop Scheduled Item shell delegates cohesive form sections", async () => {
    const desktopUrl = new URL("../src/features/capture/scheduled-item/ui/desktop/", import.meta.url);
    await Promise.all([
        access(new URL("DesktopTemporalSection.ts", desktopUrl)),
        access(new URL("DesktopDetailSection.ts", desktopUrl)),
        access(new URL("DesktopCreateTargetSection.ts", desktopUrl)),
    ]);
    const shell = await readFile(new URL("DesktopScheduledItemForm.ts", desktopUrl), "utf8");
    assert.ok(shell.split(/\r?\n/).length < 250);
    assert.match(shell, /renderDesktopTemporalSection/);
    assert.match(shell, /renderDesktopDetailSection/);
    assert.match(shell, /renderDesktopCreateTargetSection/);
    assert.doesNotMatch(shell, /private render(?:Task|Event|Detail|CreateContext)\b/);
});
