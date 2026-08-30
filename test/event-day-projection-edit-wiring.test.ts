import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Real Obsidian modal/screen classes can't be instantiated in node:test (see
// mobile-scheduled-item-create-composition.test.ts for the established pattern), so this
// characterizes that both edit surfaces reconcile Event day references against the dates the
// edit actually saved, using the previous (pre-edit) touched days as the reconciliation baseline.

test("desktop and mobile Edit flows reconcile Event day references after a successful primary write", async () => {
    const [desktopEdit, mobileEdit] = await Promise.all([
        readFile(
            new URL(
                "../src/features/capture/scheduled-item/ui/desktop/ScheduledItemDesktopEditModal.ts",
                import.meta.url,
            ),
            "utf8",
        ),
        readFile(
            new URL(
                "../src/features/capture/scheduled-item/ui/mobile/ScheduledItemMobileEditScreen.ts",
                import.meta.url,
            ),
            "utf8",
        ),
    ]);
    for (const source of [desktopEdit, mobileEdit]) {
        assert.match(source, /await this\.writeEventDayProjection\(writer\);/);
        assert.match(
            source,
            /touchedDayKeysFromEventFormFields\(this\.original\.start, this\.original\.end, this\.original\.allDay\)/,
        );
        assert.match(source, /runEventDayProjection\(/);
        assert.match(source, /retryEventDayProjectionRuntime\(/);
    }
});
