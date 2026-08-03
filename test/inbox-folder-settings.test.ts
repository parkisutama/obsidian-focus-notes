import assert from "node:assert/strict";
import test from "node:test";
import { normalizeInboxFolders } from "../src/InboxFolderSettings.ts";

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
