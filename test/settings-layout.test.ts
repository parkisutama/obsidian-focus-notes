import assert from "node:assert/strict";
import test from "node:test";
import { CAPTURE_CATEGORIES, parentView, ROOT_CATEGORIES } from "../src/SettingsLayout.ts";

test("lists root categories in the confirmed order", () => {
    assert.deepEqual(
        ROOT_CATEGORIES.map((c) => c.id),
        ["periodical", "objects", "focus", "capture", "timeline"],
    );
    for (const category of ROOT_CATEGORIES) {
        assert.ok(category.label.length > 0);
        assert.ok(category.description.length > 0);
    }
});

test("lists capture sub-categories in display order", () => {
    assert.deepEqual(
        CAPTURE_CATEGORIES.map((c) => c.id),
        ["capture-moment", "capture-event", "capture-task", "capture-shared"],
    );
    for (const category of CAPTURE_CATEGORIES) {
        assert.ok(category.label.length > 0);
        assert.ok(category.description.length > 0);
    }
});

test("resolves every root category's parent to root", () => {
    for (const category of ROOT_CATEGORIES) {
        assert.equal(parentView(category.id), "root");
    }
});

test("resolves every capture sub-category's parent to capture", () => {
    for (const category of CAPTURE_CATEGORIES) {
        assert.equal(parentView(category.id), "capture");
    }
});

test("resolves the Object Source edit page's parent to objects", () => {
    assert.equal(parentView("objects-source"), "objects");
});

test("root has no parent", () => {
    assert.equal(parentView("root"), null);
});
