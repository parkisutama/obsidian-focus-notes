import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Task 31: "The automatic target is calculated from Planned Start and updates
// while the user has not manually edited Save to file. Manual target edits
// disable automatic path updates for that form instance." Real DOM/Obsidian
// wiring can't be unit-instantiated here (no Obsidian runtime in node:test),
// so this characterizes the source contract the same way
// mobile-scheduled-item-create-composition.test.ts does for its sibling flows.

test("opening an Event capture never substitutes the ambient active note for the configured target", async () => {
    const launcher = await readFile(
        new URL("../src/features/capture/ui/EventTaskCaptureLauncher.ts", import.meta.url),
        "utf8",
    );
    assert.match(
        launcher,
        /kind === "task"\s*\n\s*\?\s*preferActiveNoteTarget\([\s\S]*?\)\s*\n\s*:\s*resolveEventCaptureTarget\(/,
    );
});

test("desktop and mobile create contexts track manual target edits", async () => {
    const [desktopSection, mobileSection] = await Promise.all([
        readFile(
            new URL("../src/features/capture/scheduled-item/ui/desktop/DesktopCreateTargetSection.ts", import.meta.url),
            "utf8",
        ),
        readFile(
            new URL("../src/features/capture/scheduled-item/ui/mobile/MobileSupplementalSections.ts", import.meta.url),
            "utf8",
        ),
    ]);
    assert.match(desktopSection, /targetManuallyEdited:\s*boolean/);
    assert.match(desktopSection, /options\.context\.targetManuallyEdited\s*=\s*true/);
    assert.match(mobileSection, /targetManuallyEdited:\s*boolean/);
    assert.match(mobileSection, /options\.context\.targetManuallyEdited\s*=\s*true/);
});

test("desktop and mobile Planned start changes notify the shared auto-target hook", async () => {
    const [desktopTemporal, mobileTemporal] = await Promise.all([
        readFile(
            new URL("../src/features/capture/scheduled-item/ui/desktop/DesktopTemporalSection.ts", import.meta.url),
            "utf8",
        ),
        readFile(
            new URL("../src/features/capture/scheduled-item/ui/mobile/MobileTemporalSection.ts", import.meta.url),
            "utf8",
        ),
    ]);
    assert.match(desktopTemporal, /onEventStartChanged\?\.\(data\.start\)/);
    assert.match(mobileTemporal, /onEventStartChanged\?\.\(data\.start\)/);
});

test("desktop and mobile create flows recompute the Event target from Planned Start unless manually edited", async () => {
    const [desktopModal, mobileScreen] = await Promise.all([
        readFile(
            new URL(
                "../src/features/capture/scheduled-item/ui/desktop/ScheduledItemDesktopCreateModal.ts",
                import.meta.url,
            ),
            "utf8",
        ),
        readFile(
            new URL(
                "../src/features/capture/scheduled-item/ui/mobile/ScheduledItemMobileCreateScreen.ts",
                import.meta.url,
            ),
            "utf8",
        ),
    ]);
    for (const source of [desktopModal, mobileScreen]) {
        assert.match(source, /resolveEventCaptureTarget/);
        assert.match(source, /if \(this\.kind !== "event" \|\| this\.context\.targetManuallyEdited\) return;/);
        assert.match(source, /getPeriodicalTarget\(settings\.captureEvent\.profileId, start\)/);
    }
});
