import assert from "node:assert/strict";
import test from "node:test";
import { recordFocusSessionInBlock } from "../src/features/focus-session/domain/CanonicalFocusSessionAppend.ts";

const fields = {
    actualStart: "2026-09-01 09:12",
    actualEnd: "2026-09-01 09:37",
    durationSeconds: 1500,
    mode: "pomodoro" as const,
};

test("appends actual time directly under a Task, independent of Timeboxes", () => {
    const block = [
        "- [ ] Report ^task-abc1234567",
        "    - timebox: start:2026-09-01 08:00 | end:2026-09-01 09:00 | status:planned ^timebox-aaaaaaaaaa",
    ].join("\n");
    const result = recordFocusSessionInBlock(
        block,
        { kind: "task", itemId: "task-abc1234567" },
        fields,
        "focus-aaaaaaaaaa",
    );
    assert.equal(result.status, "recorded");
    if (result.status !== "recorded") return;
    assert.equal(
        result.block,
        `${block}\n    - focus-session: start:2026-09-01 09:12 | end:2026-09-01 09:37 | duration:25m | mode:pomodoro ^focus-aaaaaaaaaa\n`,
    );
});

test("writes optional Reflection as children of the Focus Session and is idempotent", () => {
    const block = "- Workshop ^event-abc1234567";
    const first = recordFocusSessionInBlock(
        block,
        { kind: "event", itemId: "event-abc1234567" },
        {
            ...fields,
            stressLevel: "medium",
            emotionCategory: "pleasant",
            emotionKey: "calm",
            notes: "Useful session",
        },
        "focus-aaaaaaaaaa",
    );
    assert.equal(first.status, "recorded");
    if (first.status !== "recorded") return;
    assert.match(first.block, / {8}- reflection: stress:medium \| emotion:pleasant \| mood:calm/);
    assert.match(first.block, / {8}- reflection-notes: Useful session/);
    assert.deepEqual(
        recordFocusSessionInBlock(
            first.block,
            { kind: "event", itemId: "event-abc1234567" },
            fields,
            "focus-aaaaaaaaaa",
        ),
        { status: "already-recorded", block: first.block },
    );
});
