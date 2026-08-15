import assert from "node:assert/strict";
import test from "node:test";
import { formatEventTaskEntry } from "../src/EventTaskMarkdown.ts";
import type { EventRecord } from "../src/EventTaskWriter.ts";
import { ScheduledItemParser } from "../src/ScheduledItemParser.ts";

const source = {
    groupId: "daily-notes",
    groupName: "Daily Notes",
    filePath: "Daily/2026-08-10.md",
    fileName: "2026-08-10.md",
    lineNumber: 4,
    headingPath: ["Activities & Tasks"],
};

test("legacy and explicit planned Events share planned lifecycle semantics", () => {
    const parser = new ScheduledItemParser();
    const legacy = parser.parseLine("- 2026-08-10 09:00 - 10:00 Review proposal", source);
    const explicit = parser.parseLine("- 2026-08-10 09:00 - 10:00 Review proposal | status:planned", source);

    assert.equal(legacy?.eventStatus, "planned");
    assert.equal(explicit?.eventStatus, "planned");
    assert.equal(explicit?.title, "Review proposal");
    assert.equal(explicit?.actualStart, null);
    assert.equal(explicit?.actualEnd, null);
});

test("completed Event round trip preserves a distinct actual interval", () => {
    const record: EventRecord = {
        kind: "event",
        title: "Review proposal",
        start: new Date(2026, 7, 10, 9, 0),
        end: new Date(2026, 7, 10, 10, 0),
        allDay: false,
        status: "completed",
        actualStart: new Date(2026, 7, 10, 9, 12),
        actualEnd: new Date(2026, 7, 10, 10, 18),
        description: "",
        hubNoteRef: null,
    };

    const markdown = formatEventTaskEntry(record);
    const parsed = new ScheduledItemParser().parseLine(markdown, source);

    assert.equal(
        markdown,
        "- 2026-08-10 09:00 - 10:00 Review proposal | status:completed | actual-start:2026-08-10 09:12 | actual-end:2026-08-10 10:18",
    );
    assert.equal(parsed?.eventStatus, "completed");
    assert.equal(parsed?.actualStart?.getTime(), record.actualStart?.getTime());
    assert.equal(parsed?.actualEnd?.getTime(), record.actualEnd?.getTime());
});

test("explicit all-day and cancelled Events parse without classifying ordinary dated bullets", () => {
    const parser = new ScheduledItemParser();
    const allDay = parser.parseLine(
        "- 2026-08-10 Company holiday | type:event | all-day:true | status:cancelled",
        source,
    );

    assert.equal(allDay?.kind, "event");
    assert.equal(allDay?.allDay, true);
    assert.equal(allDay?.eventStatus, "cancelled");
    assert.equal(allDay?.end?.getTime(), new Date(2026, 7, 11, 0, 0).getTime());
    assert.equal(parser.parseLine("- 2026-08-10 Ordinary dated note", source), null);
});

test("invalid lifecycle combinations are rejected instead of inventing state", () => {
    const parser = new ScheduledItemParser();

    assert.equal(parser.parseLine("- 2026-08-10 09:00 - 10:00 Review | status:unknown", source), null);
    assert.equal(
        parser.parseLine(
            "- 2026-08-10 09:00 - 10:00 Review | status:completed | actual-start:2026-08-10 09:12",
            source,
        ),
        null,
    );
    assert.equal(
        parser.parseLine(
            "- 2026-08-10 09:00 - 10:00 Review | status:cancelled | actual-start:2026-08-10 09:12 | actual-end:2026-08-10 10:18",
            source,
        ),
        null,
    );
    assert.equal(parser.parseLine("- 2026-02-30 Invalid | type:event | all-day:true", source), null);
    assert.equal(parser.parseLine("- 2026-02-30 09:00 - 10:00 Invalid", source), null);
});
