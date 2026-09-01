import assert from "node:assert/strict";
import test from "node:test";
import {
    formatInboxEntry,
    formatRelativeMarkdownLink,
    relativeMarkdownPath,
} from "../src/features/capture/moment/domain/InboxMarkdown.ts";
import { unwrapMarkdownLinkLabel } from "../src/shared/markdown/MarkdownLink.ts";
import { createMomentBlockId } from "../src/features/capture/scheduled-item/domain/ScheduledItemBlockId.ts";
import { parseMomentBlock } from "../src/features/capture/moment/domain/MomentBlock.ts";

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
        "- 2026-08-01 15:40\n    - description: Catatan",
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
            "    - description: Pertahankan **Markdown** #follow-up dan [link](url)",
    );
});

test("writes Moment wellbeing and optional Reflection Notes as separate sibling children", () => {
    assert.equal(
        formatInboxEntry({
            kind: "inbox",
            capturedAt: new Date(2026, 7, 1, 15, 40),
            defaultTitle: "2026-08-01 15:40",
            title: "Check in",
            body: "Before the meeting",
            stressLevel: "medium",
            emotionCategory: "unpleasant",
            emotionKey: "anxious",
            reflectionNotes: "Prepare one question first.",
        }),
        "- 2026-08-01 15:40 — Check in\n" +
            "    - description: Before the meeting\n" +
            "    - reflection: stress:medium | emotion:unpleasant | mood:anxious\n" +
            "    - reflection-notes: Prepare one question first.",
    );
});

test("writes a time-only timestamp for weekly-note captures without changing the title comparison", () => {
    const capturedAt = new Date(2026, 7, 1, 15, 40);

    assert.equal(
        formatInboxEntry(
            {
                kind: "inbox",
                capturedAt,
                defaultTitle: "2026-08-01 15:40",
                title: "2026-08-01 15:40",
                body: "Catatan",
            },
            { timeOnly: true },
        ),
        "- 15:40\n    - description: Catatan",
    );
    assert.equal(
        formatInboxEntry(
            {
                kind: "inbox",
                capturedAt,
                defaultTitle: "2026-08-01 15:40",
                title: "Hubungi vendor",
                body: "",
            },
            { timeOnly: true },
        ),
        "- 15:40 — Hubungi vendor",
    );
});

test("assigns a stable moment block id on create and round-trips it back into a MomentBlock", () => {
    const blockId = createMomentBlockId(() => "moment-aaaaaaaaaa");

    const entry = formatInboxEntry(
        {
            kind: "inbox",
            capturedAt: new Date(2026, 7, 1, 15, 40),
            defaultTitle: "2026-08-01 15:40",
            title: "Check in",
            body: "Before the meeting",
            stressLevel: "medium",
            emotionCategory: "unpleasant",
            emotionKey: "anxious",
            reflectionNotes: "Prepare one question first.",
        },
        { blockId },
    );

    assert.equal(
        entry,
        "- 2026-08-01 15:40 — Check in ^moment-aaaaaaaaaa\n" +
            "    - description: Before the meeting\n" +
            "    - reflection: stress:medium | emotion:unpleasant | mood:anxious\n" +
            "    - reflection-notes: Prepare one question first.",
    );

    const parsed = parseMomentBlock(entry);
    assert.equal(parsed.status, "parsed");
    if (parsed.status !== "parsed") return;
    assert.equal(parsed.block.momentId, blockId);
    assert.equal(parsed.block.description, "Before the meeting");
    assert.equal(parsed.block.reflectionNotes, "Prepare one question first.");
    assert.deepEqual(parsed.block.reflection, {
        stressLevel: "medium",
        emotionCategory: "unpleasant",
        emotionKey: "anxious",
    });
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

test("recovers the plain label from a Markdown link, round-tripping formatRelativeMarkdownLink", () => {
    const link = formatRelativeMarkdownLink("Persona/Report.md", "Journal/2026-08-01.md", "2026-08-01 17:00");
    assert.equal(unwrapMarkdownLinkLabel(link), "2026-08-01 17:00");
});

test("leaves a plain, unlinked value unchanged", () => {
    assert.equal(unwrapMarkdownLinkLabel("2026-08-01 17:00"), "2026-08-01 17:00");
    assert.equal(unwrapMarkdownLinkLabel(""), "");
});

test("unescapes a label that itself contained brackets", () => {
    const link = formatRelativeMarkdownLink("Persona/Report.md", "Journal/2026-08-01.md", "Andi [Tim]");
    assert.equal(unwrapMarkdownLinkLabel(link), "Andi [Tim]");
});
