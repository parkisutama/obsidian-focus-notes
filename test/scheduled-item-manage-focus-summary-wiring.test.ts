import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("desktop and mobile Manage compute the focus summary from the shared Task 61/63 function, not a second calculation", async () => {
    const [desktop, mobile] = await Promise.all([
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
    for (const source of [desktop, mobile]) {
        assert.match(
            source,
            /import \{[\s\S]*?formatScheduledItemFocusSummary,[\s\S]*?summarizeScheduledItemFocus,[\s\S]*?\} from "\.\.\/\.\.\/domain\/ScheduledItemFocusSummary\.ts";/,
        );
        assert.match(source, /focusSummary: formatScheduledItemFocusSummary\(this\.computeFocusSummary\(\)\)/);
    }
});

test("the shared summary module never touches the vault — Task 64's no-write guarantee", async () => {
    const source = await readFile(
        new URL("../src/features/capture/scheduled-item/domain/ScheduledItemFocusSummary.ts", import.meta.url),
        "utf8",
    );
    assert.doesNotMatch(source, /vault\.|\bapp\b|obsidian/i);
});

test("desktop and mobile summary sections only render pre-formatted labels, never write them", async () => {
    const [desktop, mobile] = await Promise.all([
        readFile(
            new URL("../src/features/capture/scheduled-item/ui/desktop/DesktopFocusSummarySection.ts", import.meta.url),
            "utf8",
        ),
        readFile(
            new URL("../src/features/capture/scheduled-item/ui/mobile/MobileFocusSummarySection.ts", import.meta.url),
            "utf8",
        ),
    ]);
    for (const source of [desktop, mobile]) {
        assert.doesNotMatch(source, /vault\.|process\(|save[A-Z]/);
        assert.match(source, /summary: FormattedFocusSummary/);
    }
});
