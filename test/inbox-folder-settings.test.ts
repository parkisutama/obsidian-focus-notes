import assert from "node:assert/strict";
import test from "node:test";
import { applyInboxContextOverrides, normalizeInboxFolders } from "../src/InboxFolderSettings.ts";
import { DEFAULT_SETTINGS } from "../src/types.ts";

test("normalizes Inbox source folders without changing their order", () => {
    assert.deepEqual(normalizeInboxFolders([" /People/ ", "People/Clients", "", "  Place  "]), [
        "People",
        "People/Clients",
        "Place",
    ]);
});

test("de-duplicates Inbox source folders case-insensitively", () => {
    assert.deepEqual(normalizeInboxFolders(["People", "people/", "PEOPLE/Clients", "People/Clients"]), [
        "People",
        "PEOPLE/Clients",
    ]);
});

test("applies per-capture legacy overrides without mutating generic sources", () => {
    const sources = DEFAULT_SETTINGS.inbox.contextSources;
    const overridden = applyInboxContextOverrides(sources, ["CRM/People"], ["Atlas/Places"]);

    assert.deepEqual(overridden.find((source) => source.id === "people")?.folders, ["CRM/People"]);
    assert.deepEqual(overridden.find((source) => source.id === "places")?.folders, ["Atlas/Places"]);
    assert.deepEqual(overridden.find((source) => source.id === "activities")?.folders, ["Activities"]);
    assert.deepEqual(sources.find((source) => source.id === "people")?.folders, ["People"]);
});
