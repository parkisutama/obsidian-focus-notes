import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Event/Task desktop temporal fields, Timebox Manager, and mobile form fields all use the custom picker, not native date/time inputs", async () => {
    const files = [
        "../src/features/capture/scheduled-item/ui/desktop/DesktopTemporalSection.ts",
        "../src/features/capture/scheduled-item/ui/desktop/TimeboxManagerModal.ts",
        "../src/features/capture/scheduled-item/ui/mobile/MobileFormFields.ts",
    ];
    for (const relativePath of files) {
        const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
        assert.doesNotMatch(source, /type: "date"|type: "time"|type: "datetime-local"/, relativePath);
        assert.match(source, /DateTimePicker/, relativePath);
    }
});

test("DesktopScheduledItemForm tracks and destroys date/time pickers created by the temporal section", async () => {
    const source = await readFile(
        new URL("../src/features/capture/scheduled-item/ui/desktop/DesktopScheduledItemForm.ts", import.meta.url),
        "utf8",
    );
    assert.match(source, /this\.dateTimePickers = renderDesktopTemporalSection/);
    assert.match(source, /for \(const picker of this\.dateTimePickers\) picker\.destroy\(\);/);
});

test("TimeboxManagerModal destroys its date/time pickers before every re-render and on close", async () => {
    const source = await readFile(
        new URL("../src/features/capture/scheduled-item/ui/desktop/TimeboxManagerModal.ts", import.meta.url),
        "utf8",
    );
    assert.match(source, /private destroyDateTimePickers\(\): void/);
    assert.match(source, /onClose\(\): void \{\s*this\.destroyDateTimePickers\(\);/);
    assert.match(source, /private render\(\): void \{\s*this\.destroyDateTimePickers\(\);/);
});
