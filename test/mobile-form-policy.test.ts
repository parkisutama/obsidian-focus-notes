import assert from "node:assert/strict";
import test from "node:test";
import { shouldUseMobileForm } from "../src/features/capture/scheduled-item/ui/mobile/MobileFormPolicy.ts";

test("uses the mobile form whenever Obsidian reports mobile mode", () => {
    assert.equal(shouldUseMobileForm(true, 1200), true);
});

test("allows narrow desktop windows to preview the mobile form", () => {
    assert.equal(shouldUseMobileForm(false, 640), true);
    assert.equal(shouldUseMobileForm(false, 641), false);
});
