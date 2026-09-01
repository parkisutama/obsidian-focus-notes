import assert from "node:assert/strict";
import test from "node:test";
import { scanFocusSessionsInBlock } from "../src/features/focus-session/domain/FocusSessionBlockScan.ts";

test("scans direct owner sessions and their optional Reflection children", () => {
    const block = [
        "- [ ] Report ^task-abc1234567",
        "    - timebox: start:2026-09-01 08:00 | end:2026-09-01 09:00 | status:planned ^timebox-aaaaaaaaaa",
        "    - focus-session: start:2026-09-01 09:12 | end:2026-09-01 09:37 | duration:25m | mode:pomodoro ^focus-aaaaaaaaaa",
        "        - reflection: stress:medium | emotion:pleasant | mood:calm",
        "        - reflection-notes: Finished the difficult section.",
        "    - focus-session: start:2026-09-01 10:00 | end:2026-09-01 10:25 | duration:25m | mode:pomodoro ^focus-bbbbbbbbbb",
    ].join("\n");
    assert.deepEqual(scanFocusSessionsInBlock(block), [
        {
            sessionId: "focus-aaaaaaaaaa",
            start: "2026-09-01 09:12",
            end: "2026-09-01 09:37",
            durationSeconds: 1500,
            mode: "pomodoro",
            stressLevel: "medium",
            emotionCategory: "pleasant",
            emotionKey: "calm",
            notes: "Finished the difficult section.",
        },
        {
            sessionId: "focus-bbbbbbbbbb",
            start: "2026-09-01 10:00",
            end: "2026-09-01 10:25",
            durationSeconds: 1500,
            mode: "pomodoro",
            stressLevel: null,
            emotionCategory: null,
            emotionKey: null,
            notes: null,
        },
    ]);
});

test("ignores sessions nested under a Timebox", () => {
    const block = [
        "- [ ] Report ^task-abc1234567",
        "    - timebox: start:2026-09-01 08:00 | end:2026-09-01 09:00 | status:planned ^timebox-aaaaaaaaaa",
        "        - focus-session: start:2026-09-01 08:10 | end:2026-09-01 08:20 | duration:10m | mode:timer ^focus-aaaaaaaaaa",
    ].join("\n");
    assert.deepEqual(scanFocusSessionsInBlock(block), []);
});
