import assert from "node:assert/strict";
import test from "node:test";
import {
    assessTimelineTarget,
    effectiveTimelineSourceFolders,
    isFileInTimelineSource,
} from "../src/TimelineSourceAlignment.ts";

test("automatically adds the Daily Notes folder without duplicating configured sources", () => {
    assert.deepEqual(effectiveTimelineSourceFolders(["Projects", "calendar"], "calendar"), ["Projects", "calendar"]);
    assert.deepEqual(effectiveTimelineSourceFolders(["Projects"], "calendar"), ["Projects", "calendar"]);
});

test("keeps Timeline indexing folder-scoped when Daily Notes live at vault root", () => {
    assert.deepEqual(effectiveTimelineSourceFolders(["Projects"], ""), ["Projects"]);
    assert.deepEqual(effectiveTimelineSourceFolders([], null), []);
});

test("reports aligned and mismatched capture targets", () => {
    const folders = ["calendar", "Projects/Active"];
    assert.equal(assessTimelineTarget("calendar/2026/2026-08-03.md", folders), "aligned");
    assert.equal(assessTimelineTarget("Projects/Active/Blok G2.md", folders), "aligned");
    assert.equal(assessTimelineTarget("Archive/Plan.md", folders), "mismatch");
    assert.equal(assessTimelineTarget("", folders), "unresolved");
    assert.equal(assessTimelineTarget("Daily.md", []), "unconfigured");
});

test("matches Markdown files only inside configured source folders", () => {
    assert.equal(isFileInTimelineSource("calendar/2026-08-03.md", ["calendar"]), true);
    assert.equal(isFileInTimelineSource("calendar-old/2026-08-03.md", ["calendar"]), false);
});
