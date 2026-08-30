import assert from "node:assert/strict";
import test from "node:test";
import { removeMarkdownLineWithBlockId } from "../src/features/capture/scheduled-item/domain/ScheduledItemLineRemoval.ts";

test("removes the matching line and its terminator while preserving the rest of the file", () => {
    const content = "# Day\n\n- Standup ^event-ref-aaaaaaaaaa\n- Lunch ^event-ref-bbbbbbbbbb\n";
    assert.equal(
        removeMarkdownLineWithBlockId(content, "event-ref-aaaaaaaaaa"),
        "# Day\n\n- Lunch ^event-ref-bbbbbbbbbb\n",
    );
});

test("removes the last line of a file with no trailing newline", () => {
    const content = "# Day\n\n- Standup ^event-ref-aaaaaaaaaa";
    assert.equal(removeMarkdownLineWithBlockId(content, "event-ref-aaaaaaaaaa"), "# Day\n\n");
});

test("preserves CRLF line endings on every remaining line", () => {
    const content = "# Day\r\n- Standup ^event-ref-aaaaaaaaaa\r\n- Lunch ^event-ref-bbbbbbbbbb\r\n";
    assert.equal(
        removeMarkdownLineWithBlockId(content, "event-ref-aaaaaaaaaa"),
        "# Day\r\n- Lunch ^event-ref-bbbbbbbbbb\r\n",
    );
});

test("is an idempotent no-op when the block id is already gone", () => {
    const content = "# Day\n\n- Lunch ^event-ref-bbbbbbbbbb\n";
    assert.equal(removeMarkdownLineWithBlockId(content, "event-ref-aaaaaaaaaa"), content);
});
