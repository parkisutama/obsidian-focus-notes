import assert from "node:assert/strict";
import test from "node:test";
import {
    formatObjectReferencePart,
    isInboxLineBreakInput,
    parseInboxRichText,
    parseObjectReferenceRichText,
    serializeInboxRichText,
} from "../src/InboxRichText.ts";
import { formatRelativeMarkdownLink } from "../src/InboxMarkdown.ts";

test("parses a Markdown mention into a live-link model and preserves surrounding text", () => {
    assert.deepEqual(
        parseInboxRichText("Meet [Rina](../People/Rina.md) tomorrow", (destination) =>
            destination === "../People/Rina.md" ? "People/Rina.md" : null,
        ),
        [
            { kind: "text", value: "Meet " },
            { kind: "link", label: "Rina", filePath: "People/Rina.md" },
            { kind: "text", value: " tomorrow" },
        ],
    );
});

test("serializes live links relative to the current Save to target", () => {
    const parts = [
        { kind: "text" as const, value: "Meet " },
        { kind: "link" as const, label: "Rina", filePath: "People/Rina.md" },
    ];

    assert.equal(
        serializeInboxRichText(parts, "Daily/2026-08-02.md", formatRelativeMarkdownLink),
        "Meet [Rina](../People/Rina.md)",
    );
    assert.equal(serializeInboxRichText(parts, "Inbox.md", formatRelativeMarkdownLink), "Meet [Rina](People/Rina.md)");
});

test("keeps an unresolved Markdown link editable as source text", () => {
    assert.deepEqual(
        parseInboxRichText("See [site](https://example.com)", () => null),
        [{ kind: "text", value: "See [site](https://example.com)" }],
    );
});

test("normalizes browser paragraph and line-break input into plain newlines", () => {
    assert.equal(isInboxLineBreakInput("insertParagraph"), true);
    assert.equal(isInboxLineBreakInput("insertLineBreak"), true);
    assert.equal(isInboxLineBreakInput("insertText"), false);
    assert.equal(isInboxLineBreakInput("insertCompositionText"), false);
});

test("parses and serializes resolved Object References without Markdown links", () => {
    const parts = parseObjectReferenceRichText("Meet @{People/Rina.md} and @Unresolved");
    assert.deepEqual(parts, [
        { kind: "text", value: "Meet " },
        { kind: "link", label: "Rina", filePath: "People/Rina.md" },
        { kind: "text", value: " and @Unresolved" },
    ]);
    assert.equal(
        serializeInboxRichText(parts, "Daily/2026-08-02.md", formatObjectReferencePart),
        "Meet @{People/Rina.md} and @Unresolved",
    );
});
