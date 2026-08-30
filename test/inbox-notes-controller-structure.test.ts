import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import type { ContextSuggestion } from "../src/features/capture/moment/application/InboxSuggestions.ts";
import { composeMentionSuggestions } from "../src/features/capture/moment/ui/InboxSuggestionPresentation.ts";

const match: ContextSuggestion = {
    kind: "object",
    filePath: "People/Rina.md",
    label: "Rina",
    matchedBy: "filename",
    sourceId: "people",
    sourceName: "People",
    sourceIcon: "user",
};

test("mention presentation preserves kind shortcuts, limits, and create action", () => {
    assert.deepEqual(
        composeMentionSuggestions("", [match], false, 3).map((suggestion) => suggestion.kind),
        ["mention-kind", "mention-kind", "mention"],
    );
    assert.deepEqual(
        composeMentionSuggestions("rina", [match], true, 2).map((suggestion) => suggestion.kind),
        ["mention", "create-object"],
    );
    assert.deepEqual(
        composeMentionSuggestions("rina", [match], false, 2).map((suggestion) => suggestion.kind),
        ["mention"],
    );
});

test("controller retains lifecycle composition while DOM and presentation have narrow owners", async () => {
    const uiUrl = new URL("../src/features/capture/moment/ui/", import.meta.url);
    await Promise.all([
        access(new URL("InboxNotesDom.ts", uiUrl)),
        access(new URL("InboxSuggestionPresentation.ts", uiUrl)),
    ]);
    const controller = await readFile(new URL("InboxNotesController.ts", uiUrl), "utf8");
    assert.ok(controller.split(/\r?\n/).length < 400);
    assert.doesNotMatch(controller, /^function (?:readDomParts|getSelectionOffsets|pointAtOffset)\b/m);
});
