import assert from "node:assert/strict";
import test from "node:test";
import {
    formatEventDayReferenceLine,
    localDayKey,
    parseEventDayReferenceLine,
    removeEventDayReferenceForCanonical,
    touchedLocalDays,
} from "../src/features/capture/scheduled-item/domain/EventDayReference.ts";
import { planEventDayReferences } from "../src/features/capture/scheduled-item/domain/EventDayReferencePlan.ts";

test("a same-day Event touches exactly one local day", () => {
    const start = new Date(2026, 8, 1, 9, 0);
    const end = new Date(2026, 8, 1, 12, 0);
    assert.deepEqual(touchedLocalDays(start, end).map(localDayKey), ["2026-09-01"]);
});

test("a cross-day Event touches every local day it spans inclusively", () => {
    const start = new Date(2026, 8, 30, 22, 0);
    const end = new Date(2026, 9, 2, 6, 0);
    assert.deepEqual(touchedLocalDays(start, end).map(localDayKey), ["2026-09-30", "2026-10-01", "2026-10-02"]);
});

test("an Event with no end touches only its start day", () => {
    const start = new Date(2026, 8, 1, 9, 0);
    assert.deepEqual(touchedLocalDays(start, null).map(localDayKey), ["2026-09-01"]);
});

test("touched days survive a spring-forward DST boundary without skipping or repeating a day", () => {
    // US DST 2026 spring-forward: 2026-03-08. Local wall-clock day math must not lose this day.
    const start = new Date(2026, 2, 7, 22, 0);
    const end = new Date(2026, 2, 9, 6, 0);
    assert.deepEqual(touchedLocalDays(start, end).map(localDayKey), ["2026-03-07", "2026-03-08", "2026-03-09"]);
});

test("formats and parses a timed cross-day Event reference round trip", () => {
    const line = formatEventDayReferenceLine({
        title: "Workshop",
        start: new Date(2026, 8, 1, 9, 0),
        end: new Date(2026, 9, 2, 12, 0),
        allDay: false,
        canonicalFilePath: "Projects/Team.md",
        canonicalBlockId: "event-abc1234567",
        referenceBlockId: "event-ref-jjjjjjjjjj",
    });
    assert.equal(
        line,
        "- 2026-09-01 09:00 - 12:00 Workshop | canonical:[[Projects/Team.md#^event-abc1234567|Workshop]] ^event-ref-jjjjjjjjjj",
    );
    assert.deepEqual(parseEventDayReferenceLine(line), {
        title: "Workshop",
        start: "2026-09-01 09:00",
        end: "12:00",
        allDay: false,
        canonicalTarget: "Projects/Team.md#^event-abc1234567",
        referenceBlockId: "event-ref-jjjjjjjjjj",
    });
});

test("a legacy unaliased canonical link (written before aliasing existed) still parses to the same canonicalTarget", () => {
    const legacyLine =
        "- 2026-09-01 09:00 - 12:00 Workshop | canonical:[[Projects/Team.md#^event-abc1234567]] ^event-ref-jjjjjjjjjj";
    assert.deepEqual(parseEventDayReferenceLine(legacyLine), {
        title: "Workshop",
        start: "2026-09-01 09:00",
        end: "12:00",
        allDay: false,
        canonicalTarget: "Projects/Team.md#^event-abc1234567",
        referenceBlockId: "event-ref-jjjjjjjjjj",
    });
});

test("formats and parses an all-day Event reference round trip", () => {
    const line = formatEventDayReferenceLine({
        title: "Conference",
        start: new Date(2026, 8, 2),
        end: null,
        allDay: true,
        canonicalFilePath: "Projects/Team.md",
        canonicalBlockId: "event-abc1234567",
        referenceBlockId: "event-ref-jjjjjjjjjj",
    });
    assert.equal(
        line,
        "- 2026-09-02 Conference | canonical:[[Projects/Team.md#^event-abc1234567|Conference]] ^event-ref-jjjjjjjjjj",
    );
    const parsed = parseEventDayReferenceLine(line);
    assert.equal(parsed?.allDay, true);
    assert.equal(parsed?.end, null);
});

test("a canonical Event line is never misclassified as a reference", () => {
    assert.equal(parseEventDayReferenceLine("- 2026-09-01 09:00 - 12:00 Workshop ^event-abc1234567"), null);
});

test("a line whose trailing id is not an event-reference block id is rejected even with matching shape", () => {
    assert.equal(
        parseEventDayReferenceLine(
            "- 2026-09-01 09:00 - 12:00 Workshop | canonical:[[Projects/Team.md#^event-abc1234567]] ^task-ref-jjjjjjjjjj",
        ),
        null,
    );
});

test("plans only the newly touched days when an Event grows across days", () => {
    const plan = planEventDayReferences(["2026-09-01"], ["2026-09-01", "2026-09-02", "2026-09-03"], "2026-09-01");
    assert.deepEqual(plan.createDays, ["2026-09-02", "2026-09-03"]);
    assert.deepEqual(plan.removeDays, []);
});

test("plans removal for days no longer touched when an Event shrinks", () => {
    const plan = planEventDayReferences(["2026-09-01", "2026-09-02", "2026-09-03"], ["2026-09-01"], "2026-09-01");
    assert.deepEqual(plan.createDays, []);
    assert.deepEqual(plan.removeDays, ["2026-09-02", "2026-09-03"]);
});

test("removes the reference line pointing at a given canonical target and leaves other days alone", () => {
    const content = [
        "- 2026-09-02 09:00 - 12:00 Workshop | canonical:[[Projects/Team.md#^event-abc1234567]] ^event-ref-aaaaaaaaaa",
        "- 2026-09-02 14:00 - 15:00 Standup | canonical:[[Projects/Team.md#^event-zzzzzzzzzz]] ^event-ref-bbbbbbbbbb",
        "",
    ].join("\n");
    assert.equal(
        removeEventDayReferenceForCanonical(content, "Projects/Team.md#^event-abc1234567"),
        "- 2026-09-02 14:00 - 15:00 Standup | canonical:[[Projects/Team.md#^event-zzzzzzzzzz]] ^event-ref-bbbbbbbbbb\n",
    );
});

test("removing a reference for a canonical target that never had one is a no-op", () => {
    const content =
        "- 2026-09-02 14:00 - 15:00 Standup | canonical:[[Projects/Team.md#^event-zzzzzzzzzz]] ^event-ref-bbbbbbbbbb\n";
    assert.equal(removeEventDayReferenceForCanonical(content, "Projects/Team.md#^event-abc1234567"), content);
});

test("plans never touch the canonical day itself even if it moves in and out of the list", () => {
    const plan = planEventDayReferences(["2026-09-01"], ["2026-09-02"], "2026-09-02");
    assert.deepEqual(plan.createDays, []);
    assert.deepEqual(plan.removeDays, ["2026-09-01"]);
});
