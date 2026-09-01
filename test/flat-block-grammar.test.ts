import assert from "node:assert/strict";
import test from "node:test";
import { parseScheduledItemBlock } from "../src/features/capture/scheduled-item/domain/ScheduledItemBlockEditor.ts";
import {
    formatTaskTimeboxLine,
    parseTaskTimeboxLine,
} from "../src/features/capture/scheduled-item/domain/TaskTimeboxLine.ts";
import {
    formatFocusSessionLine,
    parseFocusSessionLine,
} from "../src/features/focus-session/domain/FocusSessionLine.ts";
import {
    formatReflectionLabelLine,
    parseReflectionLabel,
} from "../src/features/reflection/domain/ReflectionBlockLine.ts";
import {
    formatDescriptionLine,
    formatReflectionNotesLine,
    parseDescriptionLine,
    parseReflectionNotesLine,
} from "../src/features/capture/shared/domain/FlatBlockChildLine.ts";

test("free-text keyed children normalize to one line and preserve inline Markdown", () => {
    assert.equal(
        formatDescriptionLine("    ", "  Use [[Sources/Q3.md]]\n  and #quarterly. "),
        "    - description: Use [[Sources/Q3.md]] and #quarterly.",
    );
    assert.equal(
        parseDescriptionLine("description: Use [[Sources/Q3.md]] and #quarterly."),
        "Use [[Sources/Q3.md]] and #quarterly.",
    );
    assert.equal(
        formatReflectionNotesLine("    ", " First observation.\nSecond observation. "),
        "    - reflection-notes: First observation. Second observation.",
    );
    assert.equal(
        parseReflectionNotesLine("reflection-notes: First observation. Second observation."),
        "First observation. Second observation.",
    );
    assert.equal(formatDescriptionLine("    ", " \n "), null);
    assert.equal(formatReflectionNotesLine("    ", ""), null);
});

test("Reflection wellbeing is optional and tolerant of unknown values", () => {
    assert.deepEqual(parseReflectionLabel("reflection: stress:normal | emotion:pleasant | mood:focused"), {
        stressLevel: "normal",
        emotionCategory: "pleasant",
        emotionKey: "focused",
    });
    assert.deepEqual(parseReflectionLabel("reflection: stress:future | emotion:future"), {
        stressLevel: null,
        emotionCategory: null,
        emotionKey: null,
    });
    assert.equal(
        formatReflectionLabelLine("    ", {
            stressLevel: null,
            emotionCategory: null,
            emotionKey: null,
        }),
        "    - reflection:",
    );
});

test("canonical child line writers use the approved keyed prefixes", () => {
    assert.equal(
        formatTaskTimeboxLine({
            timeboxId: "timebox-aaaaaaaaaa",
            start: "2026-09-01 09:00",
            end: "2026-09-01 11:00",
            status: "planned",
        }),
        "    - timebox: start:2026-09-01 09:00 | end:2026-09-01 11:00 | status:planned ^timebox-aaaaaaaaaa",
    );
    assert.equal(
        formatFocusSessionLine({
            start: "2026-09-01 09:12",
            end: "2026-09-01 09:37",
            durationSeconds: 1500,
            mode: "pomodoro",
            sessionId: "focus-bbbbbbbbbb",
        }),
        "    - focus-session: start:2026-09-01 09:12 | end:2026-09-01 09:37 | duration:25m | mode:pomodoro ^focus-bbbbbbbbbb",
    );
    assert.equal(
        formatReflectionLabelLine("    ", {
            stressLevel: "normal",
            emotionCategory: "pleasant",
            emotionKey: "focused",
        }),
        "    - reflection: stress:normal | emotion:pleasant | mood:focused",
    );
});

test("canonical keyed child lines parse independently", () => {
    assert.equal(
        parseTaskTimeboxLine(
            "    - timebox: start:2026-09-01 09:00 | end:2026-09-01 11:00 | status:planned ^timebox-aaaaaaaaaa",
        ).status,
        "parsed",
    );
    assert.equal(
        parseFocusSessionLine(
            "    - focus-session: start:2026-09-01 09:12 | end:2026-09-01 09:37 | duration:25m | mode:pomodoro ^focus-bbbbbbbbbb",
        ).status,
        "parsed",
    );
    assert.deepEqual(parseReflectionLabel("reflection: stress:normal | emotion:pleasant | mood:focused"), {
        stressLevel: "normal",
        emotionCategory: "pleasant",
        emotionKey: "focused",
    });
});

test("a canonical Task block separates description, sibling planning and actual time, Reflection, and Detail", () => {
    const block = [
        "- [ ] Prepare report ^task-cccccccccc",
        "    - description: Use [[Sources/Q3.md]] and keep this on one line.",
        "    - timebox: start:2026-09-01 09:00 | end:2026-09-01 11:00 | status:planned ^timebox-aaaaaaaaaa",
        "    - focus-session: start:2026-09-01 09:12 | end:2026-09-01 09:37 | duration:25m | mode:pomodoro ^focus-bbbbbbbbbb",
        "        - reflection: stress:normal | emotion:pleasant | mood:focused",
        "        - reflection-notes: Useful actual-work context.",
        "    - reflection: stress:low | emotion:pleasant | mood:satisfied",
        "    - reflection-notes: The estimate missed data cleanup.",
        "    - detail: [Report detail](Details/Report%20detail.md)",
        "    - custom: preserve this unknown child",
    ].join("\n");

    const parsed = parseScheduledItemBlock(block);
    assert.equal(parsed.status, "parsed");
    if (parsed.status !== "parsed") return;
    assert.equal(parsed.block.description, "Use [[Sources/Q3.md]] and keep this on one line.");
    assert.equal(parsed.block.timeboxes.length, 1);
    assert.equal(parsed.block.reflectionNotes, "The estimate missed data cleanup.");
});
