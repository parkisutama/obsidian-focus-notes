import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SETTINGS, mergeSettingsWithDefaults } from "../src/types.ts";

test("adds Inbox defaults when loading settings saved before Inbox existed", () => {
    const merged = mergeSettingsWithDefaults({
        pomodoroMinutes: 45,
        eventTask: { ...DEFAULT_SETTINGS.eventTask, hubNotesFolder: "Hubs" },
    });

    assert.equal(merged.pomodoroMinutes, 45);
    assert.equal(merged.eventTask.hubNotesFolder, "Hubs");
    assert.deepEqual(merged.inbox, {
        defaultTargetMode: "daily-note",
        heading: "Inbox",
        position: "end",
        peopleFolders: ["People"],
        placeFolders: ["Place"],
    });
});

test("clones saved and default Inbox folder arrays during settings merge", () => {
    const savedPeople = ["CRM/People"];
    const first = mergeSettingsWithDefaults({
        inbox: { ...DEFAULT_SETTINGS.inbox, peopleFolders: savedPeople },
    });
    const second = mergeSettingsWithDefaults({});

    first.inbox.peopleFolders.push("Clients");
    first.inbox.placeFolders.push("Travel");

    assert.deepEqual(savedPeople, ["CRM/People"]);
    assert.deepEqual(second.inbox.peopleFolders, ["People"]);
    assert.deepEqual(second.inbox.placeFolders, ["Place"]);
    assert.deepEqual(DEFAULT_SETTINGS.inbox.peopleFolders, ["People"]);
    assert.deepEqual(DEFAULT_SETTINGS.inbox.placeFolders, ["Place"]);
});
