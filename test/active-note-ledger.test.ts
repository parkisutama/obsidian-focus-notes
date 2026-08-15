import assert from "node:assert/strict";
import test from "node:test";
import { scanActiveNoteLedger } from "../src/ActiveNoteLedger.ts";
import { ScheduledItemParser } from "../src/ScheduledItemParser.ts";

test("finds scheduled and unscheduled ledger records only under accepted headings", () => {
    const content = [
        "# Daily note",
        "- [ ] Ordinary checkbox | due:2026-08-20",
        "",
        "## Activities & Tasks",
        "- [ ] Unscheduled ledger task",
        "- [ ] Due task | due:2026-08-21",
        "- 2026-08-21 09:00 - 10:00 Review",
        "",
        "### Notes",
        "- [ ] Nested task | remind:2026-08-21 08:00",
        "",
        "## Archive",
        "- [ ] Archived | due:2026-08-19",
    ].join("\n");

    const items = scanActiveNoteLedger(
        "Daily/2026-08-20.md",
        "2026-08-20.md",
        content,
        ["Activities & Tasks"],
        new ScheduledItemParser(),
    );

    assert.deepEqual(
        items.map((item) => ({ kind: item.kind, title: item.title, line: item.source.lineNumber })),
        [
            { kind: "task", title: "Unscheduled ledger task", line: 5 },
            { kind: "task", title: "Due task", line: 6 },
            { kind: "event", title: "Review", line: 7 },
            { kind: "task", title: "Nested task", line: 10 },
        ],
    );
    assert.deepEqual(items[3]?.source.headingPath, ["Daily note", "Activities & Tasks", "Notes"]);
    assert.equal(items[0]?.rawLine, "- [ ] Unscheduled ledger task");
});

test("matches headings case-insensitively and returns no records without an accepted heading", () => {
    const parser = new ScheduledItemParser();
    assert.equal(
        scanActiveNoteLedger(
            "Projects/A.md",
            "A.md",
            "## activities & tasks\n- [ ] Task",
            ["Activities & Tasks"],
            parser,
        ).length,
        1,
    );
    assert.deepEqual(scanActiveNoteLedger("Projects/A.md", "A.md", "## Notes\n- [ ] Task", [], parser), []);
});
