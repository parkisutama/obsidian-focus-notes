import assert from "node:assert/strict";
import test from "node:test";
import { editFocusSessionInBlock } from "../src/features/focus-session/domain/CanonicalFocusSessionAppend.ts";

test("edits only nested Reflection while preserving actual session facts", () => {
    const block = [
        "- [ ] Report ^task-abc1234567",
        "    - focus-session: start:2026-09-01 09:12 | end:2026-09-01 09:37 | duration:25m | mode:pomodoro ^focus-aaaaaaaaaa",
        "        - reflection-notes: Old note",
    ].join("\n");
    const result = editFocusSessionInBlock(block, "focus-aaaaaaaaaa", {
        stressLevel: "high",
        emotionCategory: "unpleasant",
        emotionKey: "tense",
        notes: "New note",
    });
    assert.equal(result.status, "edited");
    if (result.status !== "edited") return;
    assert.match(result.block, /start:2026-09-01 09:12 \| end:2026-09-01 09:37 \| duration:25m \| mode:pomodoro/);
    assert.match(result.block, /reflection: stress:high \| emotion:unpleasant \| mood:tense/);
    assert.match(result.block, /reflection-notes: New note/);
    assert.doesNotMatch(result.block, /Old note/);
});
