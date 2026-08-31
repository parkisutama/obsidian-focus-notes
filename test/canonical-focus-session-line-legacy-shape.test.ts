import assert from "node:assert/strict";
import test from "node:test";
import {
    formatFocusSessionLine,
    parseFocusSessionLine,
} from "../src/features/focus-session/domain/FocusSessionLine.ts";

/**
 * Pins the pre-Edit-Session-feature canonical `focus-session` line shape byte-for-byte, mirroring
 * how scheduled-item-migration-contract.test.ts pins the Task/Event canonical grammar. Reflection
 * fields (mood/stress/notes) were added later as optional trailing data — a line minted with no
 * reflection fields must keep producing and parsing this exact legacy shape forever, since real
 * vaults already contain lines in this shape.
 */

test("a line with no reflection fields formats to the exact legacy 4-field shape", () => {
    const line = formatFocusSessionLine({
        start: "2026-08-31 09:12",
        end: "2026-08-31 09:37",
        durationSeconds: 1500,
        mode: "pomodoro",
        sessionId: "focus-aaaaaaaaaa",
    });
    assert.equal(
        line,
        "    - focus-session | start:2026-08-31 09:12 | end:2026-08-31 09:37 | duration:25m | mode:pomodoro ^focus-aaaaaaaaaa",
    );
});

test("the exact legacy 4-field line still parses, with reflection fields reported absent", () => {
    const legacyLine =
        "    - focus-session | start:2026-08-31 09:12 | end:2026-08-31 09:37 | duration:25m | mode:pomodoro ^focus-aaaaaaaaaa";
    assert.deepEqual(parseFocusSessionLine(legacyLine), {
        status: "parsed",
        session: {
            start: "2026-08-31 09:12",
            end: "2026-08-31 09:37",
            durationSeconds: 1500,
            mode: "pomodoro",
            sessionId: "focus-aaaaaaaaaa",
            stressLevel: null,
            emotionCategory: null,
            emotionKey: null,
        },
    });
});
