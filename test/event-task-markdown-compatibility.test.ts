import assert from "node:assert/strict";
import test from "node:test";
import {
    formatEventTaskEntry,
    formatTaskPriorityFrontmatter,
} from "../src/features/capture/scheduled-item/domain/EventTaskMarkdown.ts";
import type { EventRecord, TaskRecord } from "../src/features/capture/scheduled-item/domain/EventTaskRecord.ts";
import { formatRelativeMarkdownLink } from "../src/features/capture/moment/domain/InboxMarkdown.ts";
import { ScheduledItemParser } from "../src/features/capture/scheduled-item/domain/ScheduledItemParser.ts";
import { buildScheduledItemRecord } from "../src/features/capture/scheduled-item/domain/ScheduledItemFormAdapter.ts";
import type { ScheduledItemFormData } from "../src/features/capture/scheduled-item/domain/ScheduledItemFormData.ts";

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
        status: "planned",
        actualStart: null,
        actualEnd: null,
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
            "    - description: First line Second line\n" +
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

    const markdown = formatEventTaskEntry(record, null, undefined, "task-test", "timebox-test");
    const item = new ScheduledItemParser().parseLine(markdown.split("\n")[0] ?? "", source);

    assert.equal(item?.kind, "task");
    assert.equal(item?.priority, "high");
    assert.equal(item?.title, "Prepare report");
    assert.equal(item?.start, null);
    assert.equal(item?.end, null);
    assert.match(
        markdown,
        / {4}- timebox: start:2026-08-01 13:00 \| end:2026-08-01 15:00 \| status:planned \^timebox-test/,
    );
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

test("Task date fields become links when a formatDateLink resolver is supplied", () => {
    const record: TaskRecord = {
        kind: "task",
        title: "Prepare report",
        priority: "normal",
        due: new Date(2026, 7, 1, 17, 0),
        dueHasTime: true,
        timebox: {
            start: new Date(2026, 7, 1, 13, 0),
            end: new Date(2026, 7, 1, 15, 0),
        },
        reminders: [new Date(2026, 7, 1, 12, 45)],
        description: "",
        hubNoteRef: null,
    };
    const formatDateLink = (when: Date, label: string) =>
        formatRelativeMarkdownLink("Persona/Report.md", `Journal/${when.getFullYear()}-08-01.md`, label);

    const markdown = formatEventTaskEntry(record, null, formatDateLink, "task-test", "timebox-test");

    assert.equal(
        markdown,
        "- [ ] Prepare report" +
            " | due:[2026-08-01 17:00](../Journal/2026-08-01.md)" +
            " | remind:[2026-08-01 12:45](../Journal/2026-08-01.md) ^task-test\n" +
            "    - timebox: start:2026-08-01 13:00 | end:2026-08-01 15:00 | status:planned ^timebox-test",
    );

    const item = new ScheduledItemParser().parseLine(markdown.split("\n")[0] ?? "", source);
    assert.equal(item?.due?.getTime(), record.due?.getTime());
    assert.equal(item?.start, null);
    assert.equal(item?.end, null);
    assert.equal(item?.remind?.getTime(), record.reminders[0]?.getTime());
});

test("Task date fields stay plain text when no formatDateLink resolver is supplied", () => {
    const record: TaskRecord = {
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

    const markdown = formatEventTaskEntry(record);

    assert.equal(markdown, "- [ ] Submit invoice | due:2026-08-02");
});

test("canonical writer appends a supplied block ID after all Task metadata", () => {
    const record: TaskRecord = {
        kind: "task",
        title: "Submit invoice",
        priority: "normal",
        due: new Date(2026, 7, 2),
        dueHasTime: false,
        timebox: null,
        reminders: [],
        description: "",
        hubNoteRef: null,
    };

    assert.equal(
        formatEventTaskEntry(record, null, undefined, "fn-task-a1b2c3"),
        "- [ ] Submit invoice | due:2026-08-02 ^fn-task-a1b2c3",
    );
});

test("Create Task carries form reflection into canonical keyed children", () => {
    const data: ScheduledItemFormData = {
        kind: "task",
        title: "Review proposal",
        description: "Compare\nall options",
        objectReferences: [],
        detailNote: { mode: "none" },
        completed: false,
        priority: "normal",
        due: null,
        timebox: { start: "2026-08-01 13:00", end: "2026-08-01 14:00" },
        reminders: [],
        stressLevel: "medium",
        emotionCategory: "pleasant",
        emotionKey: "hopeful",
        reflectionNotes: "A clear next step emerged.",
    };
    const built = buildScheduledItemRecord(data);
    assert.equal(built.status, "ready");
    if (built.status !== "ready") return;

    assert.equal(
        formatEventTaskEntry(built.record, null, undefined, "task-test", "timebox-test"),
        "- [ ] Review proposal ^task-test\n" +
            "    - description: Compare all options\n" +
            "    - timebox: start:2026-08-01 13:00 | end:2026-08-01 14:00 | status:planned ^timebox-test\n" +
            "    - reflection: stress:medium | emotion:pleasant | mood:hopeful\n" +
            "    - reflection-notes: A clear next step emerged.",
    );
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
