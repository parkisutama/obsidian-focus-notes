import assert from "node:assert/strict";
import test from "node:test";
import { editFocusSessionInBlock } from "../src/features/focus-session/domain/CanonicalFocusSessionAppend.ts";

test("adds reflection fields and a notes child line to a session that had none", () => {
    const rawBlock =
        "- Workshop | start:2026-09-01 09:00 | end:2026-09-01 12:00 ^event-abc1234567\n" +
        "  - focus-session | start:2026-09-01 09:08 | end:2026-09-01 10:02 | duration:54m | mode:stopwatch ^focus-aaaaaaaaaa\n";
    const result = editFocusSessionInBlock(rawBlock, "focus-aaaaaaaaaa", {
        stressLevel: "low",
        emotionCategory: "pleasant",
        emotionKey: "calm",
        notes: "Good deep-work block.",
    });
    assert.equal(result.status, "edited");
    assert.equal(
        result.status === "edited" ? result.block : "",
        "- Workshop | start:2026-09-01 09:00 | end:2026-09-01 12:00 ^event-abc1234567\n" +
            "  - focus-session | start:2026-09-01 09:08 | end:2026-09-01 10:02 | duration:54m | mode:stopwatch | stress:low | emotion:pleasant | mood:calm ^focus-aaaaaaaaaa\n" +
            "    - notes: Good deep-work block.\n",
    );
});

test("preserves start/end/duration/mode exactly while editing reflection fields", () => {
    const rawBlock =
        "- [ ] Menyusun laporan | due:2026-09-03 ^task-def4567890\n" +
        "  - timebox | start:2026-08-31 09:00 | end:2026-08-31 11:00 | status:planned ^timebox-def456abcd\n" +
        "    - focus-session | start:2026-08-31 09:12 | end:2026-08-31 09:37 | duration:25m | mode:pomodoro ^focus-def456abcd\n";
    const result = editFocusSessionInBlock(rawBlock, "focus-def456abcd", {
        stressLevel: "medium",
        emotionCategory: null,
        emotionKey: null,
        notes: null,
    });
    assert.equal(result.status, "edited");
    assert.match(
        result.status === "edited" ? result.block : "",
        /focus-session \| start:2026-08-31 09:12 \| end:2026-08-31 09:37 \| duration:25m \| mode:pomodoro \| stress:medium \^focus-def456abcd/,
    );
});

test("replaces an existing notes child line rather than duplicating it", () => {
    const rawBlock =
        "- Workshop | start:2026-09-01 09:00 | end:2026-09-01 12:00 ^event-abc1234567\n" +
        "  - focus-session | start:2026-09-01 09:08 | end:2026-09-01 10:02 | duration:54m | mode:stopwatch | mood:calm ^focus-aaaaaaaaaa\n" +
        "    - notes: Old reflection.\n";
    const result = editFocusSessionInBlock(rawBlock, "focus-aaaaaaaaaa", {
        stressLevel: null,
        emotionCategory: null,
        emotionKey: "excited",
        notes: "Updated reflection.",
    });
    assert.equal(result.status, "edited");
    const block = result.status === "edited" ? result.block : "";
    assert.equal((block.match(/- notes:/g) ?? []).length, 1);
    assert.match(block, /- notes: Updated reflection\./);
    assert.doesNotMatch(block, /Old reflection/);
});

test("clearing notes removes the child line entirely", () => {
    const rawBlock =
        "- Workshop | start:2026-09-01 09:00 | end:2026-09-01 12:00 ^event-abc1234567\n" +
        "  - focus-session | start:2026-09-01 09:08 | end:2026-09-01 10:02 | duration:54m | mode:stopwatch ^focus-aaaaaaaaaa\n" +
        "    - notes: Old reflection.\n";
    const result = editFocusSessionInBlock(rawBlock, "focus-aaaaaaaaaa", {
        stressLevel: null,
        emotionCategory: null,
        emotionKey: null,
        notes: "",
    });
    assert.equal(result.status, "edited");
    assert.doesNotMatch(result.status === "edited" ? result.block : "", /notes/);
});

test("editing an unknown sessionId reports not-found", () => {
    const rawBlock =
        "- Workshop | start:2026-09-01 09:00 | end:2026-09-01 12:00 ^event-abc1234567\n" +
        "  - focus-session | start:2026-09-01 09:08 | end:2026-09-01 10:02 | duration:54m | mode:stopwatch ^focus-aaaaaaaaaa\n";
    const result = editFocusSessionInBlock(rawBlock, "focus-zzzzzzzzzz", {
        stressLevel: "low",
        emotionCategory: null,
        emotionKey: null,
        notes: null,
    });
    assert.deepEqual(result, { status: "not-found" });
});

test("editing among multiple sessions in the same block only touches the targeted one", () => {
    const rawBlock =
        "- [ ] Menyusun laporan | due:2026-09-03 ^task-abc1234567\n" +
        "  - timebox | start:2026-08-31 09:00 | end:2026-08-31 11:00 | status:planned ^timebox-aaaaaaaaaa\n" +
        "    - focus-session | start:2026-08-31 09:12 | end:2026-08-31 09:37 | duration:25m | mode:pomodoro ^focus-aaaaaaaaaa\n" +
        "    - focus-session | start:2026-08-31 10:00 | end:2026-08-31 10:25 | duration:25m | mode:pomodoro ^focus-bbbbbbbbbb\n";
    const result = editFocusSessionInBlock(rawBlock, "focus-bbbbbbbbbb", {
        stressLevel: "high",
        emotionCategory: null,
        emotionKey: null,
        notes: null,
    });
    assert.equal(result.status, "edited");
    const block = result.status === "edited" ? result.block : "";
    assert.match(block, /\^focus-aaaaaaaaaa\n/);
    assert.doesNotMatch(block.split("\n")[2], /stress:/);
    assert.match(block, /mode:pomodoro \| stress:high \^focus-bbbbbbbbbb/);
});
