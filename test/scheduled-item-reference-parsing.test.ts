import assert from "node:assert/strict";
import test from "node:test";
import { ScheduledItemParser } from "../src/features/capture/scheduled-item/domain/ScheduledItemParser.ts";

const source = {
    groupId: "daily-notes",
    groupName: "Daily Notes",
    filePath: "Daily/2026-09-02.md",
    fileName: "2026-09-02.md",
    lineNumber: 4,
    headingPath: ["Activities & Tasks"],
};

test("parseReferenceLine reads an Event day reference for reference-aware display", () => {
    const parser = new ScheduledItemParser();
    const item = parser.parseReferenceLine(
        "- 2026-09-02 09:00 - 12:00 Workshop | canonical:[[Projects/Team.md#^event-abc1234567]] ^event-ref-jjjjjjjjjj",
        source,
    );
    assert.deepEqual(item, {
        id: "event-ref-jjjjjjjjjj",
        blockId: "event-ref-jjjjjjjjjj",
        referenceTarget: "Projects/Team.md#^event-abc1234567",
        kind: "event",
        title: "Workshop",
        start: null,
        end: null,
        due: null,
        dueHasTime: false,
        remind: null,
        priority: null,
        eventStatus: null,
        actualStart: null,
        actualEnd: null,
        allDay: false,
        isCompleted: false,
        source,
        rawLine:
            "- 2026-09-02 09:00 - 12:00 Workshop | canonical:[[Projects/Team.md#^event-abc1234567]] ^event-ref-jjjjjjjjjj",
    });
});

test("parseReferenceLine reads a Task day reference, including its timebox role and completion", () => {
    const parser = new ScheduledItemParser();
    const line =
        "- [x] Menyusun laporan | canonical:[[Projects/Report.md#^task-def4567890]] | timebox:timebox-def456aa11 ^task-ref-jjjjjjjjjj";
    const item = parser.parseReferenceLine(line, source);
    assert.equal(item?.kind, "task");
    assert.equal(item?.id, "task-ref-jjjjjjjjjj");
    assert.equal(item?.referenceTarget, "Projects/Report.md#^task-def4567890");
    assert.equal(item?.timeboxId, "timebox-def456aa11");
    assert.equal(item?.isCompleted, true);
    assert.equal(item?.title, "Menyusun laporan");
});

test("parseReferenceLine returns null for a canonical line and for unrelated text", () => {
    const parser = new ScheduledItemParser();
    assert.equal(parser.parseReferenceLine("- 2026-09-01 09:00 - 12:00 Workshop ^event-abc1234567", source), null);
    assert.equal(parser.parseReferenceLine("- [ ] Ordinary Task | due:2026-09-03 ^task-abc1234567", source), null);
    assert.equal(parser.parseReferenceLine("Just a paragraph", source), null);
});

test("parseLine and parseReferenceLine are mutually exclusive on the same line", () => {
    const parser = new ScheduledItemParser();
    const refLine =
        "- [ ] Menyusun laporan | canonical:[[Projects/Report.md#^task-def4567890]] | due:true ^task-ref-jjjjjjjjjj";
    assert.equal(parser.parseLine(refLine, source), null);
    assert.notEqual(parser.parseReferenceLine(refLine, source), null);

    const canonicalLine = "- [ ] Ordinary Task | due:2026-09-03 ^task-abc1234567";
    assert.notEqual(parser.parseLine(canonicalLine, source), null);
    assert.equal(parser.parseReferenceLine(canonicalLine, source), null);
});
