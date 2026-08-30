import assert from "node:assert/strict";
import test from "node:test";
import { detectTaskReferenceCheckboxToggles } from "../src/features/capture/scheduled-item/domain/TaskReferenceCheckboxToggle.ts";

const unchecked =
    "- [ ] Menyusun laporan | canonical:[[Projects/Report.md#^task-def4567890]] | due:true ^task-ref-jjjjjjjjjj";
const checked =
    "- [x] Menyusun laporan | canonical:[[Projects/Report.md#^task-def4567890]] | due:true ^task-ref-jjjjjjjjjj";

test("detects a checkbox flip from unchecked to checked", () => {
    const toggles = detectTaskReferenceCheckboxToggles(unchecked, checked);
    assert.deepEqual(toggles, [{ canonicalTarget: "Projects/Report.md#^task-def4567890", completed: true }]);
});

test("detects a checkbox flip from checked back to unchecked", () => {
    const toggles = detectTaskReferenceCheckboxToggles(checked, unchecked);
    assert.deepEqual(toggles, [{ canonicalTarget: "Projects/Report.md#^task-def4567890", completed: false }]);
});

test("reports nothing when content is unchanged", () => {
    assert.deepEqual(detectTaskReferenceCheckboxToggles(unchecked, unchecked), []);
});

test("reports nothing for a freshly appeared reference (no previous state to compare)", () => {
    assert.deepEqual(detectTaskReferenceCheckboxToggles("", checked), []);
});

test("reports nothing on first scan of a file (previousContent undefined)", () => {
    assert.deepEqual(detectTaskReferenceCheckboxToggles(undefined, checked), []);
});

test("ignores unrelated edits elsewhere in the file", () => {
    const before = `${unchecked}\n- Some other unrelated line\n`;
    const after = `${unchecked}\n- Some other unrelated line, edited\n`;
    assert.deepEqual(detectTaskReferenceCheckboxToggles(before, after), []);
});

test("reports only the reference whose checkbox actually changed among several", () => {
    const otherUnchecked = "- [ ] Other task | canonical:[[Projects/Other.md#^task-other000000]] ^task-ref-kkkkkkkkkk";
    const before = `${unchecked}\n${otherUnchecked}\n`;
    const after = `${checked}\n${otherUnchecked}\n`;
    assert.deepEqual(detectTaskReferenceCheckboxToggles(before, after), [
        { canonicalTarget: "Projects/Report.md#^task-def4567890", completed: true },
    ]);
});
