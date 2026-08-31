import assert from "node:assert/strict";
import test from "node:test";
import { recordFocusSessionInBlock } from "../src/features/focus-session/domain/CanonicalFocusSessionAppend.ts";

const fields = {
    actualStart: "2026-08-31 09:12",
    actualEnd: "2026-08-31 09:37",
    durationSeconds: 1500,
    mode: "pomodoro" as const,
};

test("appends a focus-session line under a Task's timebox, minted with the given id", () => {
    const rawBlock =
        "- [ ] Menyusun laporan | due:2026-09-03 ^task-def456\n" +
        "  - timebox | start:2026-08-31 09:00 | end:2026-08-31 11:00 | status:planned ^timebox-def456-a1\n";
    const result = recordFocusSessionInBlock(
        rawBlock,
        { kind: "task", itemId: "task-def456", timeboxId: "timebox-def456-a1" },
        fields,
        "focus-def456-s1",
    );
    assert.equal(result.status, "recorded");
    assert.equal(
        result.status === "recorded" ? result.block : "",
        "- [ ] Menyusun laporan | due:2026-09-03 ^task-def456\n" +
            "  - timebox | start:2026-08-31 09:00 | end:2026-08-31 11:00 | status:planned ^timebox-def456-a1\n" +
            "    - focus-session | start:2026-08-31 09:12 | end:2026-08-31 09:37 | duration:25m | mode:pomodoro ^focus-def456-s1\n",
    );
});

test("appends a focus-session line directly under an Event's own line", () => {
    const rawBlock = "- Workshop | start:2026-09-01 09:00 | end:2026-09-01 12:00 ^event-abc123\n";
    const result = recordFocusSessionInBlock(
        rawBlock,
        { kind: "event", itemId: "event-abc123", timeboxId: null },
        { actualStart: "2026-09-01 09:08", actualEnd: "2026-09-01 10:02", durationSeconds: 3240, mode: "stopwatch" },
        "focus-abc123-s1",
    );
    assert.equal(result.status, "recorded");
    assert.equal(
        result.status === "recorded" ? result.block : "",
        "- Workshop | start:2026-09-01 09:00 | end:2026-09-01 12:00 ^event-abc123\n" +
            "  - focus-session | start:2026-09-01 09:08 | end:2026-09-01 10:02 | duration:54m | mode:stopwatch ^focus-abc123-s1\n",
    );
});

test("a second logged session on the same timebox gets its own sessionId and does not replace the first", () => {
    const rawBlock =
        "- [ ] Menyusun laporan | due:2026-09-03 ^task-def456\n" +
        "  - timebox | start:2026-08-31 09:00 | end:2026-08-31 11:00 | status:planned ^timebox-def456-a1\n";
    const first = recordFocusSessionInBlock(
        rawBlock,
        { kind: "task", itemId: "task-def456", timeboxId: "timebox-def456-a1" },
        fields,
        "focus-def456-s1",
    );
    assert.equal(first.status, "recorded");
    const second = recordFocusSessionInBlock(
        first.status === "recorded" ? first.block : "",
        { kind: "task", itemId: "task-def456", timeboxId: "timebox-def456-a1" },
        { actualStart: "2026-08-31 10:00", actualEnd: "2026-08-31 10:25", durationSeconds: 1500, mode: "pomodoro" },
        "focus-def456-s2",
    );
    assert.equal(second.status, "recorded");
    const block = second.status === "recorded" ? second.block : "";
    assert.match(block, /\^focus-def456-s1/);
    assert.match(block, /\^focus-def456-s2/);
});

test("retrying with the same sessionId is a no-op instead of duplicating history", () => {
    const rawBlock = "- Workshop | start:2026-09-01 09:00 | end:2026-09-01 12:00 ^event-abc123\n";
    const first = recordFocusSessionInBlock(
        rawBlock,
        { kind: "event", itemId: "event-abc123", timeboxId: null },
        { actualStart: "2026-09-01 09:08", actualEnd: "2026-09-01 10:02", durationSeconds: 3240, mode: "stopwatch" },
        "focus-abc123-s1",
    );
    assert.equal(first.status, "recorded");
    const retry = recordFocusSessionInBlock(
        first.status === "recorded" ? first.block : "",
        { kind: "event", itemId: "event-abc123", timeboxId: null },
        { actualStart: "2026-09-01 09:08", actualEnd: "2026-09-01 10:02", durationSeconds: 3240, mode: "stopwatch" },
        "focus-abc123-s1",
    );
    assert.deepEqual(retry, { status: "already-recorded", block: first.status === "recorded" ? first.block : "" });
    const occurrences = ((retry.status === "already-recorded" ? retry.block : "").match(/\^focus-abc123-s1/g) ?? [])
        .length;
    assert.equal(occurrences, 1);
});

test("carries reflection fields captured in LogModal straight into the initial append, not just via later edit", () => {
    const rawBlock = "- Workshop | start:2026-09-01 09:00 | end:2026-09-01 12:00 ^event-abc123\n";
    const result = recordFocusSessionInBlock(
        rawBlock,
        { kind: "event", itemId: "event-abc123", timeboxId: null },
        {
            actualStart: "2026-09-01 09:08",
            actualEnd: "2026-09-01 10:02",
            durationSeconds: 3240,
            mode: "stopwatch",
            stressLevel: "low",
            emotionCategory: "pleasant",
            emotionKey: "calm",
            notes: "Good deep-work block.",
        },
        "focus-abc123-s1",
    );
    assert.equal(result.status, "recorded");
    assert.equal(
        result.status === "recorded" ? result.block : "",
        "- Workshop | start:2026-09-01 09:00 | end:2026-09-01 12:00 ^event-abc123\n" +
            "  - focus-session | start:2026-09-01 09:08 | end:2026-09-01 10:02 | duration:54m | mode:stopwatch | stress:low | emotion:pleasant | mood:calm ^focus-abc123-s1\n" +
            "    - notes: Good deep-work block.\n",
    );
});

test("appends without reflection fields exactly as before when LogModal fields are left unset", () => {
    const rawBlock = "- Workshop | start:2026-09-01 09:00 | end:2026-09-01 12:00 ^event-abc123\n";
    const result = recordFocusSessionInBlock(
        rawBlock,
        { kind: "event", itemId: "event-abc123", timeboxId: null },
        {
            actualStart: "2026-09-01 09:08",
            actualEnd: "2026-09-01 10:02",
            durationSeconds: 3240,
            mode: "stopwatch",
            stressLevel: null,
            emotionCategory: null,
            emotionKey: null,
            notes: "",
        },
        "focus-abc123-s1",
    );
    assert.equal(result.status, "recorded");
    assert.equal(
        result.status === "recorded" ? result.block : "",
        "- Workshop | start:2026-09-01 09:00 | end:2026-09-01 12:00 ^event-abc123\n" +
            "  - focus-session | start:2026-09-01 09:08 | end:2026-09-01 10:02 | duration:54m | mode:stopwatch ^focus-abc123-s1\n",
    );
});

test("appends a notes child line using the block's own CRLF convention", () => {
    const rawBlock = "- Workshop | start:2026-09-01 09:00 | end:2026-09-01 12:00 ^event-abc123\r\n";
    const result = recordFocusSessionInBlock(
        rawBlock,
        { kind: "event", itemId: "event-abc123", timeboxId: null },
        {
            actualStart: "2026-09-01 09:08",
            actualEnd: "2026-09-01 10:02",
            durationSeconds: 3240,
            mode: "stopwatch",
            notes: "Good session.",
        },
        "focus-abc123-s1",
    );
    assert.equal(result.status, "recorded");
    assert.equal(
        result.status === "recorded" ? result.block : "",
        "- Workshop | start:2026-09-01 09:00 | end:2026-09-01 12:00 ^event-abc123\r\n" +
            "  - focus-session | start:2026-09-01 09:08 | end:2026-09-01 10:02 | duration:54m | mode:stopwatch ^focus-abc123-s1\r\n" +
            "    - notes: Good session.\r\n",
    );
});

test("reports anchor-not-found when the owner's timebox or Event line is missing from the block", () => {
    const rawBlock = "- [ ] Menyusun laporan | due:2026-09-03 ^task-def456\n";
    const result = recordFocusSessionInBlock(
        rawBlock,
        { kind: "task", itemId: "task-def456", timeboxId: "timebox-missing" },
        fields,
        "focus-def456-s1",
    );
    assert.deepEqual(result, { status: "anchor-not-found" });
});
