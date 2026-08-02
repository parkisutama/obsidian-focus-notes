import assert from "node:assert/strict";
import test from "node:test";
import {
    findInboxTrigger,
    rebaseTrackedMentionLinks,
    replaceInboxTextRange
} from "../src/InboxNotesText.ts";
import { formatRelativeMarkdownLink } from "../src/InboxMarkdown.ts";

test("finds mention and tag triggers immediately before the cursor", () => {
    assert.deepEqual(findInboxTrigger("Diskusikan dengan @ndi", 22), {
        kind: "mention",
        start: 18,
        end: 22,
        query: "ndi"
    });
    assert.deepEqual(findInboxTrigger("Catatan #follow", 15), {
        kind: "tag",
        start: 8,
        end: 15,
        query: "follow"
    });
});

test("uses the cursor position instead of a later trigger", () => {
    const text = "Temui @Andi lalu #follow-up";
    assert.deepEqual(findInboxTrigger(text, 11), {
        kind: "mention",
        start: 6,
        end: 11,
        query: "Andi"
    });
});

test("does not trigger inside email addresses or after a completed token", () => {
    assert.equal(findInboxTrigger("kirim ke andi@example.com", 25), null);
    assert.equal(findInboxTrigger("Temui @Andi besok", 17), null);
});

test("replaces only the active trigger range", () => {
    assert.equal(
        replaceInboxTextRange("Temui @ndi di kantor", { start: 6, end: 10 }, "[Andi](../People/Andi.md)"),
        "Temui [Andi](../People/Andi.md) di kantor"
    );
    assert.equal(
        replaceInboxTextRange("#fol lalu #fol", { start: 10, end: 14 }, "#follow-up"),
        "#fol lalu #follow-up"
    );
});

test("rebases only tracked mention links when the Inbox destination changes", () => {
    const result = rebaseTrackedMentionLinks(
        "Temui [Andi](../People/Andi.md) dan [site](https://example.com)",
        [{
            filePath: "People/Andi.md",
            label: "Andi",
            markdown: "[Andi](../People/Andi.md)"
        }],
        "Daily/2026-08-02.md",
        "Inbox.md",
        formatRelativeMarkdownLink
    );

    assert.equal(
        result.text,
        "Temui [Andi](People/Andi.md) dan [site](https://example.com)"
    );
    assert.deepEqual(result.mentions, [{
        filePath: "People/Andi.md",
        label: "Andi",
        markdown: "[Andi](People/Andi.md)"
    }]);
});
