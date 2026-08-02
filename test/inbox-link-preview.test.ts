import assert from "node:assert/strict";
import test from "node:test";
import { extractMarkdownLinks } from "../src/InboxLinkText.ts";

test("extracts live-preview links without duplicating surrounding note text", () => {
    assert.deepEqual(
        extractMarkdownLinks("Meet [Rina](../People/Rina.md) at [HQ](../Place/HQ.md) #work"),
        ["[Rina](../People/Rina.md)", "[HQ](../Place/HQ.md)"]
    );
});

test("returns no preview for notes without Markdown links", () => {
    assert.deepEqual(extractMarkdownLinks("Plain capture #later"), []);
});
