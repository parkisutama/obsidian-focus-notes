import assert from "node:assert/strict";
import test from "node:test";
import {
    formatFocusSessionLine,
    parseFocusSessionLine,
} from "../src/features/focus-session/domain/FocusSessionLine.ts";

test("formats and parses a focus-session line round trip", () => {
    const line = formatFocusSessionLine({
        start: "2026-08-31 09:12",
        end: "2026-08-31 09:37",
        durationSeconds: 1500,
        mode: "pomodoro",
        sessionId: "focus-abc1234567",
    });
    assert.equal(
        line,
        "    - focus-session | start:2026-08-31 09:12 | end:2026-08-31 09:37 | duration:25m | mode:pomodoro ^focus-abc1234567",
    );
    assert.deepEqual(parseFocusSessionLine(line), {
        status: "parsed",
        session: {
            start: "2026-08-31 09:12",
            end: "2026-08-31 09:37",
            durationSeconds: 1500,
            mode: "pomodoro",
            sessionId: "focus-abc1234567",
            stressLevel: null,
            emotionCategory: null,
            emotionKey: null,
        },
    });
});

test("formats and parses a focus-session line carrying reflection fields", () => {
    const line = formatFocusSessionLine({
        start: "2026-08-31 09:12",
        end: "2026-08-31 09:37",
        durationSeconds: 1500,
        mode: "pomodoro",
        sessionId: "focus-abc1234567",
        stressLevel: "medium",
        emotionCategory: "pleasant",
        emotionKey: "calm",
    });
    assert.equal(
        line,
        "    - focus-session | start:2026-08-31 09:12 | end:2026-08-31 09:37 | duration:25m | mode:pomodoro | stress:medium | emotion:pleasant | mood:calm ^focus-abc1234567",
    );
    assert.deepEqual(parseFocusSessionLine(line), {
        status: "parsed",
        session: {
            start: "2026-08-31 09:12",
            end: "2026-08-31 09:37",
            durationSeconds: 1500,
            mode: "pomodoro",
            sessionId: "focus-abc1234567",
            stressLevel: "medium",
            emotionCategory: "pleasant",
            emotionKey: "calm",
        },
    });
});

test("an unrecognized reflection field value degrades to absent instead of invalidating the line", () => {
    const result = parseFocusSessionLine(
        "    - focus-session | start:2026-08-31 09:12 | end:2026-08-31 09:37 | duration:25m | mode:pomodoro | stress:extreme ^focus-abc1234567",
    );
    assert.equal(result.status, "parsed");
    assert.equal(result.status === "parsed" ? result.session.stressLevel : undefined, null);
});

test("formats and parses durations with hours, minutes, and seconds", () => {
    const withHours = formatFocusSessionLine({
        start: "2026-08-31 09:00",
        end: "2026-08-31 10:32",
        durationSeconds: 5520,
        mode: "stopwatch",
        sessionId: "focus-abc1234567",
    });
    assert.match(withHours, /duration:1h 32m/);
    assert.equal(parseFocusSessionLine(withHours).status, "parsed");

    const withSeconds = formatFocusSessionLine({
        start: "2026-08-31 09:00",
        end: "2026-08-31 09:00",
        durationSeconds: 45,
        mode: "timer",
        sessionId: "focus-abc1234567",
    });
    assert.match(withSeconds, /duration:45s/);
    assert.equal(parseFocusSessionLine(withSeconds).status, "parsed");
});

test("a line missing its identity fails explicitly instead of being silently accepted", () => {
    assert.deepEqual(
        parseFocusSessionLine(
            "    - focus-session | start:2026-08-31 09:12 | end:2026-08-31 09:37 | duration:25m | mode:pomodoro",
        ),
        { status: "invalid", reason: "missing-id" },
    );
});

test("an unrecognized mode fails explicitly", () => {
    assert.deepEqual(
        parseFocusSessionLine(
            "    - focus-session | start:2026-08-31 09:12 | end:2026-08-31 09:37 | duration:25m | mode:sprint ^focus-abc1234567",
        ),
        { status: "invalid", reason: "invalid-mode" },
    );
});

test("an unparsable duration fails explicitly", () => {
    assert.deepEqual(
        parseFocusSessionLine(
            "    - focus-session | start:2026-08-31 09:12 | end:2026-08-31 09:37 | duration:soon | mode:pomodoro ^focus-abc1234567",
        ),
        { status: "invalid", reason: "invalid-duration" },
    );
});

test("an unrelated line is reported as not-focus-session rather than invalid", () => {
    assert.deepEqual(parseFocusSessionLine("    - Some other bullet"), { status: "not-focus-session" });
});

test("a legacy free-text log line is never mistaken for an owned focus-session", () => {
    assert.deepEqual(parseFocusSessionLine("- 2026-08-31 09:12–09:37 (25m) — Deep work on the report #focus"), {
        status: "not-focus-session",
    });
});
