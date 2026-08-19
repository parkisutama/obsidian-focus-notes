import assert from "node:assert/strict";
import test from "node:test";
import { insertUnderHeading } from "../src/HeadingInsertion.ts";

test("appends without a heading regardless of position", () => {
    assert.equal(insertUnderHeading("Existing\n", "", "- new", "end"), "Existing\n- new\n");
    assert.equal(insertUnderHeading("Existing", "", "- new", "start"), "Existing\n- new\n");
});

test("creates a missing heading at the end of the file when position is end", () => {
    assert.equal(
        insertUnderHeading("## 2026-08-16\n\nold\n", "2026-08-17", "new", "end"),
        "## 2026-08-16\n\nold\n\n## 2026-08-17\n\nnew\n",
    );
});

test("creates the first-ever heading at the end even when position is start", () => {
    assert.equal(insertUnderHeading("", "2026-08-16", "- first", "start"), "\n## 2026-08-16\n\n- first\n");
});

test("creates a missing heading before the first existing level-2 heading when position is start", () => {
    assert.equal(
        insertUnderHeading(
            "# Weekly W34\n\n## 2026-08-16\n\n- 15:40 — Old capture\n",
            "2026-08-17",
            "- 09:00 — New capture",
            "start",
        ),
        "# Weekly W34\n\n## 2026-08-17\n\n- 09:00 — New capture\n\n## 2026-08-16\n\n- 15:40 — Old capture\n",
    );
});

test("keeps the newest day's heading on top across repeated weekly-note captures", () => {
    const day1 = insertUnderHeading("", "2026-08-16", "c1", "start");
    const day2 = insertUnderHeading(day1, "2026-08-17", "c2", "start");
    const day3 = insertUnderHeading(day2, "2026-08-18", "c3", "start");

    assert.equal(day3, "\n## 2026-08-18\n\nc3\n\n## 2026-08-17\n\nc2\n\n## 2026-08-16\n\nc1\n");
});

test("inserts at the start of an existing heading's section", () => {
    assert.equal(
        insertUnderHeading("## Inbox\n\n- old entry\n", "Inbox", "- new entry", "start"),
        "## Inbox\n\n- new entry\n- old entry\n",
    );
});

test("inserts at the end of an existing heading's section, stopping at the next heading", () => {
    assert.equal(
        insertUnderHeading("## Inbox\n\n- old entry\n\n## Other\n\ncontent\n", "Inbox", "- new entry", "end"),
        "## Inbox\n\n- old entry\n- new entry\n\n## Other\n\ncontent\n",
    );
});

test("inserts into an empty existing heading section for both positions", () => {
    assert.equal(insertUnderHeading("## Inbox\n", "Inbox", "- entry", "start"), "## Inbox\n\n- entry");
    assert.equal(insertUnderHeading("## Inbox\n", "Inbox", "- entry", "end"), "## Inbox\n\n- entry\n");
});

test("matches an existing heading case-insensitively regardless of its level", () => {
    assert.equal(
        insertUnderHeading("#### inbox\n\n- old\n", "Inbox", "- new", "end"),
        "#### inbox\n\n- old\n- new\n",
    );
});
