import assert from "node:assert/strict";
import test from "node:test";
import {
    formatTaskDayReferenceLine,
    parseTaskDayReferenceLine,
    removeTaskDayReference,
} from "../src/features/capture/scheduled-item/domain/TaskDayReference.ts";

const base = {
    title: "Menyusun laporan",
    completed: false,
    canonicalFilePath: "Projects/Report.md",
    canonicalBlockId: "task-def4567890",
    referenceBlockId: "task-ref-jjjjjjjjjj",
};

test("formats and parses a due-only Task reference round trip", () => {
    const line = formatTaskDayReferenceLine({ ...base, due: true, timeboxId: null });
    assert.equal(
        line,
        "- [ ] Menyusun laporan | canonical:[[Projects/Report.md#^task-def4567890|Menyusun laporan]] | due:true ^task-ref-jjjjjjjjjj",
    );
    assert.deepEqual(parseTaskDayReferenceLine(line), {
        title: "Menyusun laporan",
        completed: false,
        due: true,
        timeboxId: null,
        canonicalTarget: "Projects/Report.md#^task-def4567890",
        referenceBlockId: "task-ref-jjjjjjjjjj",
    });
});

test("a legacy unaliased canonical link (written before aliasing existed) still parses to the same canonicalTarget", () => {
    const legacyLine =
        "- [ ] Menyusun laporan | canonical:[[Projects/Report.md#^task-def4567890]] | due:true ^task-ref-jjjjjjjjjj";
    assert.deepEqual(parseTaskDayReferenceLine(legacyLine), {
        title: "Menyusun laporan",
        completed: false,
        due: true,
        timeboxId: null,
        canonicalTarget: "Projects/Report.md#^task-def4567890",
        referenceBlockId: "task-ref-jjjjjjjjjj",
    });
});

test("formats and parses a timebox-only Task reference round trip", () => {
    const line = formatTaskDayReferenceLine({ ...base, due: false, timeboxId: "timebox-def456aa11" });
    assert.equal(
        line,
        "- [ ] Menyusun laporan | canonical:[[Projects/Report.md#^task-def4567890|Menyusun laporan]] | timebox:timebox-def456aa11 ^task-ref-jjjjjjjjjj",
    );
    const parsed = parseTaskDayReferenceLine(line);
    assert.equal(parsed?.due, false);
    assert.equal(parsed?.timeboxId, "timebox-def456aa11");
});

test("formats and parses a merged due+timebox Task reference on the same day", () => {
    const line = formatTaskDayReferenceLine({ ...base, due: true, timeboxId: "timebox-def456aa11" });
    const parsed = parseTaskDayReferenceLine(line);
    assert.equal(parsed?.due, true);
    assert.equal(parsed?.timeboxId, "timebox-def456aa11");
});

test("a completed canonical Task reflects as a checked reference checkbox", () => {
    const line = formatTaskDayReferenceLine({ ...base, completed: true, due: true, timeboxId: null });
    assert.match(line, /^- \[x\]/);
    assert.equal(parseTaskDayReferenceLine(line)?.completed, true);
});

test("a canonical Task line is never misclassified as a reference", () => {
    assert.equal(parseTaskDayReferenceLine("- [ ] Menyusun laporan | due:2026-09-03 ^task-def4567890"), null);
});

test("removes the reference matching canonical target and timebox role, leaving others alone", () => {
    const dueLine = formatTaskDayReferenceLine({
        ...base,
        due: true,
        timeboxId: null,
        referenceBlockId: "task-ref-aaaaaaaaaa",
    });
    const timeboxLine = formatTaskDayReferenceLine({
        ...base,
        due: false,
        timeboxId: "timebox-def456aa11",
        referenceBlockId: "task-ref-bbbbbbbbbb",
    });
    const content = `${dueLine}\n${timeboxLine}\n`;
    assert.equal(removeTaskDayReference(content, "Projects/Report.md#^task-def4567890", null), `${timeboxLine}\n`);
});
