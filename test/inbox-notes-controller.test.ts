import assert from "node:assert/strict";
import test from "node:test";
import { findInboxTrigger } from "../src/InboxNotesText.ts";

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
