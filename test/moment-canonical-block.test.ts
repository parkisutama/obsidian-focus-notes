import assert from "node:assert/strict";
import test from "node:test";
import {
    classifyScheduledItemBlockId,
    createMomentBlockId,
} from "../src/features/capture/scheduled-item/domain/ScheduledItemBlockId.ts";
import { formatInboxEntry } from "../src/features/capture/moment/domain/InboxMarkdown.ts";
import { parseMomentBlock } from "../src/features/capture/moment/domain/MomentBlock.ts";

test("Moment IDs use a stable classified namespace", () => {
    const id = createMomentBlockId(() => "moment-aaaaaaaaaa");
    assert.equal(id, "moment-aaaaaaaaaa");
    assert.equal(classifyScheduledItemBlockId(id), "moment");
});

test("formats and parses a canonical Moment with a keyed one-line Description", () => {
    const markdown = formatInboxEntry(
        {
            kind: "inbox",
            capturedAt: new Date(2026, 8, 2, 9, 15),
            defaultTitle: "2026-09-02 09:15",
            title: "Ide integrasi",
            body: "Hubungkan Focus Session\nke Timeline",
        },
        { blockId: "moment-aaaaaaaaaa" },
    );
    assert.equal(
        markdown,
        "- 2026-09-02 09:15 — Ide integrasi ^moment-aaaaaaaaaa\n    - description: Hubungkan Focus Session ke Timeline",
    );
    assert.deepEqual(parseMomentBlock(markdown), {
        status: "parsed",
        block: {
            momentId: "moment-aaaaaaaaaa",
            heading: "2026-09-02 09:15 — Ide integrasi",
            description: "Hubungkan Focus Session ke Timeline",
            reflection: { stressLevel: null, emotionCategory: null, emotionKey: null },
            reflectionNotes: null,
        },
    });
});
