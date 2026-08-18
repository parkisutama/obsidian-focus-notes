import assert from "node:assert/strict";
import test from "node:test";
import { findInboxTrigger, leadingIndentLength, lineStartOffsets, suggestionSeparator } from "../src/InboxNotesText.ts";

test("finds mention and tag triggers immediately before the cursor", () => {
    assert.deepEqual(findInboxTrigger("Diskusikan dengan @ndi", 22), {
        kind: "mention",
        start: 18,
        end: 22,
        query: "ndi",
    });
    assert.deepEqual(findInboxTrigger("Catatan #follow", 15), {
        kind: "tag",
        start: 8,
        end: 15,
        query: "follow",
    });
});

test("uses the cursor position instead of a later trigger", () => {
    const text = "Temui @Andi lalu #follow-up";
    assert.deepEqual(findInboxTrigger(text, 11), {
        kind: "mention",
        start: 6,
        end: 11,
        query: "Andi",
    });
});

test("does not trigger inside email addresses or after a completed token", () => {
    assert.equal(findInboxTrigger("kirim ke andi@example.com", 25), null);
    assert.equal(findInboxTrigger("Temui @Andi besok", 17), null);
});

test("creates an editable separator after a selected suggestion when needed", () => {
    assert.equal(suggestionSeparator("Meet @andi", 10), " ");
    assert.equal(suggestionSeparator("Meet @andi tomorrow", 10), "");
    assert.equal(suggestionSeparator("Meet @andi,then", 10), " ");
});

test("a second mention remains detectable after the first selected mention", () => {
    const afterFirstSelection = "Meet Andi ";
    const secondInput = `${afterFirstSelection}@office`;

    assert.deepEqual(findInboxTrigger(secondInput, secondInput.length), {
        kind: "mention",
        start: afterFirstSelection.length,
        end: secondInput.length,
        query: "office",
    });
});

test("finds only the line a collapsed cursor sits on", () => {
    const text = "ab\ncd\nef";
    assert.deepEqual(lineStartOffsets(text, 1, 1), [0]);
    assert.deepEqual(lineStartOffsets(text, 0, 0), [0]);
    assert.deepEqual(lineStartOffsets(text, 4, 4), [3]);
});

test("finds every line a multi-line selection touches", () => {
    const text = "ab\ncd\nef";
    assert.deepEqual(lineStartOffsets(text, 1, 7), [0, 3, 6]);
    assert.deepEqual(lineStartOffsets(text, 3, 5), [3]);
});

test("counts up to one indent level of leading spaces or tabs", () => {
    const text = "- Dashboard :\n    - child\n\t- tabbed\n        - grandchild\n- none";
    assert.equal(leadingIndentLength(text, 0), 0);
    assert.equal(leadingIndentLength(text, 14), 4);
    assert.equal(leadingIndentLength(text, 26), 1);
    const grandchildStart = text.indexOf("        - grandchild");
    assert.equal(leadingIndentLength(text, grandchildStart), 4);
});
