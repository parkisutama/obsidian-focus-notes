import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("mobile Scheduled Item shell retains lifecycle and delegates field sections", async () => {
    const mobileUrl = new URL("../src/features/capture/scheduled-item/ui/mobile/", import.meta.url);
    await Promise.all([
        access(new URL("MobileFormFields.ts", mobileUrl)),
        access(new URL("MobileTemporalSection.ts", mobileUrl)),
        access(new URL("MobileSupplementalSections.ts", mobileUrl)),
        access(new URL("MobileReflectionSection.ts", mobileUrl)),
        access(new URL("MobileFocusSessionsSection.ts", mobileUrl)),
    ]);
    const shell = await readFile(new URL("MobileScheduledItemForm.ts", mobileUrl), "utf8");
    // Reflection adds controller lifecycle only; its field implementation remains delegated.
    assert.ok(shell.split(/\r?\n/).length < 300);
    assert.match(shell, /registerViewportLifecycle/);
    assert.match(shell, /renderMobileTemporalSection/);
    assert.match(shell, /renderMobileDetailSection/);
    assert.match(shell, /renderMobileTargetSection/);
    assert.match(shell, /renderMobileReflectionSection/);
    assert.match(shell, /renderMobileFocusSessionsSection/);
    assert.doesNotMatch(shell, /private render(?:Task|Event|Detail|Target)\b/);
});
