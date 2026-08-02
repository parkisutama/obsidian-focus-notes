import assert from "node:assert/strict";
import test from "node:test";
import { formatInboxEntry, formatRelativeMarkdownLink, relativeMarkdownPath } from "../src/InboxMarkdown.ts";

test("formats an untouched or blank Inbox title with one timestamp", () => {
    const capturedAt = new Date(2026, 7, 1, 15, 40);

    assert.equal(
        formatInboxEntry({
            kind: "inbox",
            capturedAt,
            defaultTitle: "2026-08-01 15:40",
            title: "2026-08-01 15:40",
            body: "Catatan",
        }),
        "- 2026-08-01 15:40\n    - Catatan",
    );
    assert.equal(
        formatInboxEntry({
            kind: "inbox",
            capturedAt,
            defaultTitle: "2026-08-01 15:40",
            title: "   ",
            body: "",
        }),
        "- 2026-08-01 15:40",
    );
});

test("keeps a custom title and prunes only blank body lines", () => {
    assert.equal(
        formatInboxEntry({
            kind: "inbox",
            capturedAt: new Date(2026, 7, 1, 15, 40),
            defaultTitle: "2026-08-01 15:40",
            title: "  Hubungi vendor  ",
            body: "Pertahankan **Markdown**\n   \n#follow-up dan [link](url)",
        }),
        "- 2026-08-01 15:40 — Hubungi vendor\n" +
            "    - Pertahankan **Markdown**\n" +
            "    - #follow-up dan [link](url)",
    );
});

test("builds relative Markdown paths from the destination note", () => {
    assert.equal(relativeMarkdownPath("Inbox.md", "People/Andi.md"), "People/Andi.md");
    assert.equal(relativeMarkdownPath("Journal/2026-08-01.md", "People/Andi.md"), "../People/Andi.md");
    assert.equal(relativeMarkdownPath("Journal/Daily/2026-08-01.md", "Journal/People/Andi.md"), "../People/Andi.md");
    assert.equal(relativeMarkdownPath("Journal/2026-08-01.md", "Journal/Andi.md"), "Andi.md");
});

test("encodes link destinations and escapes alias labels safely", () => {
    assert.equal(
        formatRelativeMarkdownLink("Journal/2026-08-01.md", "People/Muhammad Andi (Tim).md", "Andi [Tim]"),
        "[Andi \\[Tim\\]](../People/Muhammad%20Andi%20%28Tim%29.md)",
    );
    assert.equal(
        formatRelativeMarkdownLink("Inbox.md", "Place/Jakarta Selatan.md", "Jakarta Selatan"),
        "[Jakarta Selatan](Place/Jakarta%20Selatan.md)",
    );
});

test("encodes non-ASCII path segments without encoding parent traversal", () => {
    assert.equal(relativeMarkdownPath("Journal/Harian.md", "People/Sutami café.md"), "../People/Sutami%20caf%C3%A9.md");
});
