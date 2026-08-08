import assert from "node:assert/strict";
import test from "node:test";
import { formatEventTaskEntry, formatTaskPriorityFrontmatter } from "../src/EventTaskMarkdown.ts";
import type { EventRecord, TaskRecord } from "../src/EventTaskWriter.ts";
import { ScheduledItemParser } from "../src/ScheduledItemParser.ts";

const source = {
    groupId: "daily-notes",
    groupName: "Daily Notes",
    filePath: "Daily/2026-08-01.md",
    fileName: "2026-08-01.md",
    lineNumber: 12,
    headingPath: ["Activities & Tasks"],
};

test("writer Event Markdown is consumed as a timed Timeline Event", () => {
    const record: EventRecord = {
        kind: "event",
        title: "Review proposal",
        start: new Date(2026, 7, 1, 9, 0),
        end: new Date(2026, 7, 1, 10, 30),
        allDay: false,
        description: "First line\nSecond line",
        hubNoteRef: { title: "Review proposal", path: "Projects/Client Alpha.md" },
    };

    const markdown = formatEventTaskEntry(record, {
        title: "Review details",
        path: "Details/Review proposal.md",
    });
    const item = new ScheduledItemParser().parseLine(markdown.split("\n")[0] ?? "", source);

    assert.equal(
        markdown,
        "- 2026-08-01 09:00 - 10:30 [Review proposal](Projects/Client%20Alpha.md)\n" +
            "    - First line\n    - Second line\n" +
            "    - detail: [Review details](Details/Review%20proposal.md)",
    );
    assert.equal(item?.kind, "event");
    assert.equal(item?.title, "Review proposal");
    assert.equal(item?.start?.getTime(), record.start.getTime());
    assert.equal(item?.end?.getTime(), record.end.getTime());
});

test("writer timeboxed Task Markdown preserves schedule metadata and linked title", () => {
    const record: TaskRecord = {
        kind: "task",
        title: "Prepare report",
        priority: "high",
        due: new Date(2026, 7, 1, 17, 0),
        dueHasTime: true,
        timebox: {
            start: new Date(2026, 7, 1, 13, 0),
            end: new Date(2026, 7, 1, 15, 0),
        },
        reminders: [new Date(2026, 7, 1, 12, 45)],
        description: "Use [[People/Ana|Ana]] notes",
        hubNoteRef: { title: "Prepare report", path: "Persona/Work/Projects/Report.md" },
    };

    const markdown = formatEventTaskEntry(record);
    const item = new ScheduledItemParser().parseLine(markdown.split("\n")[0] ?? "", source);

    assert.equal(item?.kind, "task");
    assert.equal(item?.priority, "high");
    assert.equal(item?.title, "Prepare report");
    assert.equal(item?.start?.getTime(), record.timebox?.start.getTime());
    assert.equal(item?.end?.getTime(), record.timebox?.end.getTime());
    assert.equal(item?.due?.getTime(), record.due?.getTime());
    assert.equal(item?.dueHasTime, true);
    assert.equal(item?.remind?.getTime(), record.reminders[0]?.getTime());
});

test("writer due-only Task and completed Task fixture retain distinct semantics", () => {
    const dueOnly: TaskRecord = {
        kind: "task",
        title: "Submit invoice",
        priority: "normal",
        due: new Date(2026, 7, 2, 0, 0),
        dueHasTime: false,
        timebox: null,
        reminders: [],
        description: "",
        hubNoteRef: null,
    };
    const parser = new ScheduledItemParser();
    const pending = parser.parseLine(formatEventTaskEntry(dueOnly), source);
    const completed = parser.parseLine("- [x] Submit invoice | due:2026-08-02", source);

    assert.equal(pending?.kind, "task");
    assert.equal(formatEventTaskEntry(dueOnly), "- [ ] Submit invoice | due:2026-08-02");
    assert.equal(pending?.priority, "normal");
    assert.equal(pending?.isCompleted, false);
    assert.equal(pending?.start, null);
    assert.equal(pending?.dueHasTime, false);
    assert.equal(completed?.isCompleted, true);
    assert.equal(completed?.due?.getTime(), dueOnly.due?.getTime());
});

test("Task priority parser accepts canonical values and safely defaults invalid values", () => {
    const parser = new ScheduledItemParser();

    assert.equal(parser.parseLine("- [ ] Critical | priority:HIGH", source)?.priority, "high");
    assert.equal(parser.parseLine("- [ ] Important | priority:medium", source)?.priority, "medium");
    assert.equal(parser.parseLine("- [ ] Routine | priority:low", source)?.priority, "low");
    assert.equal(parser.parseLine("- [ ] Legacy", source)?.priority, "normal");
    assert.equal(parser.parseLine("- [ ] Unknown | priority:urgent", source)?.priority, "normal");
    assert.equal(parser.parseLine("- [ ] Ambiguous | priority:high | priority:low", source)?.priority, "normal");
});

test("Task detail frontmatter reflects selected priority only when enabled", () => {
    assert.equal(formatTaskPriorityFrontmatter("high", true), "priority: high");
    assert.equal(formatTaskPriorityFrontmatter("low", false), null);
});
