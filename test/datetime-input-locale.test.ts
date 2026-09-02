import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/**
 * Native <input type="date"/"time"/"datetime-local"> display format (DD/MM/YYYY vs MM/DD/YYYY,
 * 24h vs AM/PM) follows the element's effective `lang`, not app/OS settings we can otherwise
 * control. en-GB gives DD/MM/YYYY dates and a 24-hour clock.
 */
test("desktop and mobile date/time inputs request en-GB (DD/MM/YYYY, 24-hour) formatting", async () => {
    const files = [
        "../src/features/capture/scheduled-item/ui/desktop/DesktopTemporalSection.ts",
        "../src/features/capture/scheduled-item/ui/mobile/MobileFormFields.ts",
        "../src/features/capture/scheduled-item/ui/desktop/TimeboxManagerModal.ts",
    ];
    for (const relativePath of files) {
        const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
        const dateTimeInputs = source.match(/type: "(date|time|datetime-local)"[\s\S]{0,160}?\}\)/g) ?? [];
        assert.ok(dateTimeInputs.length > 0, `${relativePath} should render at least one date/time input`);
        for (const block of dateTimeInputs) {
            assert.match(block, /lang: "en-GB"/, `${relativePath}: ${block}`);
        }
    }
});
