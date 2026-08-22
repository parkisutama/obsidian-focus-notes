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

test("recognizes staged Task and Event mention queries", () => {
    assert.deepEqual(findInboxTrigger("Link @task invoice", 18), {
        kind: "scheduled-item",
        itemKind: "task",
        start: 5,
        end: 18,
        query: "invoice",
    });
    assert.deepEqual(findInboxTrigger("Link @event review", 18), {
        kind: "scheduled-item",
        itemKind: "event",
        start: 5,
        end: 18,
        query: "review",
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

test("does not trigger inside email addresses", () => {
    assert.equal(findInboxTrigger("kirim ke andi@example.com", 25), null);
});

test("keeps a mention query open across spaces so multi-word titles stay searchable", () => {
    assert.deepEqual(findInboxTrigger("Temui @Andi besok", 17), {
        kind: "mention",
        start: 6,
        end: 17,
        query: "Andi besok",
    });
});

test("a tag query still ends at the first space, since tags cannot contain spaces", () => {
    const text = "Catatan #follow up";
    assert.equal(findInboxTrigger(text, text.length), null);
});

test("a mention query ends at a line break", () => {
    const text = "Temui @Andi\nbesok pagi";
    assert.equal(findInboxTrigger(text, text.length), null);
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
