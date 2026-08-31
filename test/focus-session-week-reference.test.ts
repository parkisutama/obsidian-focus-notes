import assert from "node:assert/strict";
import test from "node:test";
import {
    formatFocusSessionWeekReferenceLine,
    localWeekKey,
    parseFocusSessionWeekReferenceLine,
} from "../src/features/focus-session/domain/FocusSessionWeekReference.ts";

test("localWeekKey resolves the ISO week-year for a mid-week date", () => {
    // 2026-09-01 is a Tuesday, ISO week 36 of 2026.
    assert.equal(localWeekKey(new Date(2026, 8, 1, 9, 0)), "2026-W36");
});

test("localWeekKey assigns early-January dates to the prior ISO week-year when appropriate", () => {
    // 2027-01-01 is a Friday; ISO week-year rolls back to the last week of 2026.
    assert.equal(localWeekKey(new Date(2027, 0, 1)), "2026-W53");
});

test("localWeekKey is stable across a week's days and changes on the ISO week boundary (Monday)", () => {
    const sunday = localWeekKey(new Date(2026, 8, 6)); // Sunday, still week 36
    const monday = localWeekKey(new Date(2026, 8, 7)); // Monday, week 37
    assert.equal(sunday, "2026-W36");
    assert.equal(monday, "2026-W37");
});

test("formats and parses a Focus Session week reference round trip, with the title as the wikilink alias", () => {
    const line = formatFocusSessionWeekReferenceLine({
        title: "Draft the proposal",
        start: new Date(2026, 8, 1, 9, 0),
        end: new Date(2026, 8, 1, 9, 25),
        canonicalTarget: "Projects/Team.md#^task-abc1234567",
        referenceBlockId: "focus-ref-jjjjjjjjjj",
    });
    assert.equal(
        line,
        "- 2026-09-01 09:00 - 09:25 Draft the proposal | canonical:[[Projects/Team.md#^task-abc1234567|Draft the proposal]] ^focus-ref-jjjjjjjjjj",
    );
    assert.deepEqual(parseFocusSessionWeekReferenceLine(line), {
        title: "Draft the proposal",
        start: "2026-09-01 09:00",
        end: "09:25",
        canonicalTarget: "Projects/Team.md#^task-abc1234567",
        referenceBlockId: "focus-ref-jjjjjjjjjj",
    });
});

test("strips characters that would break wikilink alias syntax out of the title used as an alias", () => {
    const line = formatFocusSessionWeekReferenceLine({
        title: "Fix [bug] | cleanup",
        start: new Date(2026, 8, 1, 9, 0),
        end: new Date(2026, 8, 1, 9, 25),
        canonicalTarget: "Projects/Team.md#^task-abc1234567",
        referenceBlockId: "focus-ref-jjjjjjjjjj",
    });
    assert.match(line, /\|Fix bug {2}cleanup\]\]/);
});

test("parsing tolerates an unaliased legacy-shaped canonical link (no |Label)", () => {
    const line =
        "- 2026-09-01 09:00 - 09:25 Draft the proposal | canonical:[[Projects/Team.md#^task-abc1234567]] ^focus-ref-jjjjjjjjjj";
    assert.deepEqual(parseFocusSessionWeekReferenceLine(line), {
        title: "Draft the proposal",
        start: "2026-09-01 09:00",
        end: "09:25",
        canonicalTarget: "Projects/Team.md#^task-abc1234567",
        referenceBlockId: "focus-ref-jjjjjjjjjj",
    });
});

test("a canonical Focus Session line is never misclassified as a week reference", () => {
    assert.equal(
        parseFocusSessionWeekReferenceLine(
            "- focus-session | start:2026-09-01 09:00 | end:09:25 | duration:25m | mode:pomodoro ^focus-abcdefghij",
        ),
        null,
    );
});

test("a line whose trailing id is not a focus-reference block id is rejected even with matching shape", () => {
    assert.equal(
        parseFocusSessionWeekReferenceLine(
            "- 2026-09-01 09:00 - 09:25 Draft the proposal | canonical:[[Projects/Team.md#^task-abc1234567]] ^event-ref-jjjjjjjjjj",
        ),
        null,
    );
});
