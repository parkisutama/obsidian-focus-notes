import assert from "node:assert/strict";
import test from "node:test";
import { insertScheduledItemChildLine } from "../src/features/capture/scheduled-item/domain/ScheduledItemChildInsertion.ts";

test("inserts a child line right after an anchor with no existing children", () => {
    const content = "- [ ] Menyusun laporan | due:2026-09-03 ^task-def456\n- [ ] Other task ^task-ghi789\n";
    const result = insertScheduledItemChildLine(content, "task-def456", (indent) => `${indent}- note ^note-1`);
    assert.deepEqual(result, {
        status: "inserted",
        content:
            "- [ ] Menyusun laporan | due:2026-09-03 ^task-def456\n" +
            "  - note ^note-1\n" +
            "- [ ] Other task ^task-ghi789\n",
    });
});

test("inserts after the last existing descendant of the anchor, one level deeper", () => {
    const content =
        "- [ ] Menyusun laporan | due:2026-09-03 ^task-def456\n" +
        "  - timebox | start:2026-08-31 09:00 | end:2026-08-31 11:00 | status:planned ^timebox-def456-a1\n" +
        "    - focus-session | start:2026-08-31 09:12 | end:2026-08-31 09:37 | duration:25m | mode:pomodoro ^focus-def456-s1\n";
    const result = insertScheduledItemChildLine(
        content,
        "timebox-def456-a1",
        (indent) =>
            `${indent}- focus-session | start:2026-08-31 10:00 | end:2026-08-31 10:25 | duration:25m | mode:pomodoro ^focus-def456-s2`,
    );
    assert.equal(result.status, "inserted");
    assert.equal(
        result.status === "inserted" ? result.content : "",
        "- [ ] Menyusun laporan | due:2026-09-03 ^task-def456\n" +
            "  - timebox | start:2026-08-31 09:00 | end:2026-08-31 11:00 | status:planned ^timebox-def456-a1\n" +
            "    - focus-session | start:2026-08-31 09:12 | end:2026-08-31 09:37 | duration:25m | mode:pomodoro ^focus-def456-s1\n" +
            "    - focus-session | start:2026-08-31 10:00 | end:2026-08-31 10:25 | duration:25m | mode:pomodoro ^focus-def456-s2\n",
    );
});

test("inserts directly under an Event's own first line when the anchor has no children yet", () => {
    const content = "- Workshop | start:2026-09-01 09:00 | end:2026-09-01 12:00 ^event-abc123\n";
    const result = insertScheduledItemChildLine(
        content,
        "event-abc123",
        (indent) =>
            `${indent}- focus-session | start:2026-09-01 09:08 | end:2026-09-01 10:02 | duration:54m | mode:stopwatch ^focus-abc123-s1`,
    );
    assert.deepEqual(result, {
        status: "inserted",
        content:
            "- Workshop | start:2026-09-01 09:00 | end:2026-09-01 12:00 ^event-abc123\n" +
            "  - focus-session | start:2026-09-01 09:08 | end:2026-09-01 10:02 | duration:54m | mode:stopwatch ^focus-abc123-s1\n",
    });
});

test("stops descending past a sibling at the same or shallower indent as the anchor", () => {
    const content =
        "- [ ] Task A ^task-aaa\n" +
        "  - timebox | start:2026-08-31 09:00 | end:2026-08-31 11:00 | status:planned ^timebox-aaa-a1\n" +
        "- [ ] Task B ^task-bbb\n";
    const result = insertScheduledItemChildLine(content, "task-aaa", (indent) => `${indent}- note ^note-1`);
    assert.equal(result.status, "inserted");
    assert.equal(
        result.status === "inserted" ? result.content : "",
        "- [ ] Task A ^task-aaa\n" +
            "  - timebox | start:2026-08-31 09:00 | end:2026-08-31 11:00 | status:planned ^timebox-aaa-a1\n" +
            "  - note ^note-1\n" +
            "- [ ] Task B ^task-bbb\n",
    );
});

test("appends with its own newline when the anchor line has no trailing newline", () => {
    const content = "- Workshop | start:2026-09-01 09:00 | end:2026-09-01 12:00 ^event-abc123";
    const result = insertScheduledItemChildLine(content, "event-abc123", (indent) => `${indent}- note ^note-1`);
    assert.deepEqual(result, {
        status: "inserted",
        content: "- Workshop | start:2026-09-01 09:00 | end:2026-09-01 12:00 ^event-abc123\n  - note ^note-1\n",
    });
});

test("preserves CRLF line endings", () => {
    const content = "- Workshop | start:2026-09-01 09:00 | end:2026-09-01 12:00 ^event-abc123\r\n";
    const result = insertScheduledItemChildLine(content, "event-abc123", (indent) => `${indent}- note ^note-1`);
    assert.deepEqual(result, {
        status: "inserted",
        content: "- Workshop | start:2026-09-01 09:00 | end:2026-09-01 12:00 ^event-abc123\r\n  - note ^note-1\r\n",
    });
});

test("reports anchor-not-found instead of guessing when the block id is absent", () => {
    const content = "- [ ] Task A ^task-aaa\n";
    const result = insertScheduledItemChildLine(content, "task-zzz", (indent) => `${indent}- note ^note-1`);
    assert.deepEqual(result, { status: "anchor-not-found" });
});
