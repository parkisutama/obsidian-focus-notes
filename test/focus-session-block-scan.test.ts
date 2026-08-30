import assert from "node:assert/strict";
import test from "node:test";
import { scanFocusSessionsInBlock } from "../src/features/focus-session/domain/FocusSessionBlockScan.ts";

test("attributes a focus-session directly under an Event's own line to no timebox", () => {
    const rawBlock =
        "- Workshop | start:2026-09-01 09:00 | end:2026-09-01 12:00 ^event-abc1234567\n" +
        "  - focus-session | start:2026-09-01 09:08 | end:2026-09-01 10:02 | duration:54m | mode:stopwatch ^focus-aaaaaaaaaa\n";
    assert.deepEqual(scanFocusSessionsInBlock(rawBlock), [
        {
            sessionId: "focus-aaaaaaaaaa",
            start: "2026-09-01 09:08",
            end: "2026-09-01 10:02",
            durationSeconds: 3240,
            mode: "stopwatch",
            ownerTimeboxId: null,
        },
    ]);
});

test("attributes a focus-session nested under a Task timebox to that timebox's id", () => {
    const rawBlock =
        "- [ ] Menyusun laporan | due:2026-09-03 ^task-abc1234567\n" +
        "  - timebox | start:2026-08-31 09:00 | end:2026-08-31 11:00 | status:planned ^timebox-aaaaaaaaaa\n" +
        "    - focus-session | start:2026-08-31 09:12 | end:2026-08-31 09:37 | duration:25m | mode:pomodoro ^focus-aaaaaaaaaa\n" +
        "      - notes: Menyelesaikan bagian kesimpulan\n";
    assert.deepEqual(scanFocusSessionsInBlock(rawBlock), [
        {
            sessionId: "focus-aaaaaaaaaa",
            start: "2026-08-31 09:12",
            end: "2026-08-31 09:37",
            durationSeconds: 1500,
            mode: "pomodoro",
            ownerTimeboxId: "timebox-aaaaaaaaaa",
        },
    ]);
});

test("collects multiple sessions across multiple timeboxes without mixing ownership", () => {
    const rawBlock =
        "- [ ] Menyusun laporan | due:2026-09-03 ^task-abc1234567\n" +
        "  - timebox | start:2026-08-31 09:00 | end:2026-08-31 11:00 | status:planned ^timebox-aaaaaaaaaa\n" +
        "    - focus-session | start:2026-08-31 09:12 | end:2026-08-31 09:37 | duration:25m | mode:pomodoro ^focus-aaaaaaaaaa\n" +
        "    - focus-session | start:2026-08-31 10:00 | end:2026-08-31 10:25 | duration:25m | mode:pomodoro ^focus-bbbbbbbbbb\n" +
        "  - timebox | start:2026-09-01 09:00 | end:2026-09-01 11:00 | status:planned ^timebox-cccccccccc\n" +
        "    - focus-session | start:2026-09-01 09:05 | end:2026-09-01 09:30 | duration:25m | mode:pomodoro ^focus-dddddddddd\n";
    const result = scanFocusSessionsInBlock(rawBlock);
    assert.deepEqual(
        result.map((session) => [session.sessionId, session.ownerTimeboxId]),
        [
            ["focus-aaaaaaaaaa", "timebox-aaaaaaaaaa"],
            ["focus-bbbbbbbbbb", "timebox-aaaaaaaaaa"],
            ["focus-dddddddddd", "timebox-cccccccccc"],
        ],
    );
});

test("returns an empty list for a block with no focus-session children", () => {
    const rawBlock = "- [ ] Menyusun laporan | due:2026-09-03 ^task-abc1234567\n";
    assert.deepEqual(scanFocusSessionsInBlock(rawBlock), []);
});

test("ignores an invalid focus-session line instead of throwing", () => {
    const rawBlock =
        "- Workshop | start:2026-09-01 09:00 | end:2026-09-01 12:00 ^event-abc1234567\n" +
        "  - focus-session | start:2026-09-01 09:08 | end:2026-09-01 10:02 | duration:bogus | mode:stopwatch ^focus-aaaaaaaaaa\n";
    assert.deepEqual(scanFocusSessionsInBlock(rawBlock), []);
});
