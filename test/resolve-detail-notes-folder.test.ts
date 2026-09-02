import assert from "node:assert/strict";
import test from "node:test";
import { resolveDetailNotesFolder } from "../src/features/capture/scheduled-item/domain/DetailNotesFolderResolution.ts";
import { DEFAULT_SETTINGS } from "../src/features/settings/domain/SettingsDefaults.ts";
import type { EventTaskSettings } from "../src/features/capture/scheduled-item/domain/DetailNoteSettings.ts";

function settingsWith(overrides: Partial<EventTaskSettings>): EventTaskSettings {
    return { ...DEFAULT_SETTINGS.eventTask, ...overrides };
}

const neverCalled = () => {
    throw new Error("resolveObsidianDefault should not be called for this strategy");
};

test('"configured" strategy always uses the single shared folder, regardless of source or kind', () => {
    const settings = settingsWith({ detailNotesFolderStrategy: "configured", detailNotesFolder: "Detail Notes" });
    assert.equal(resolveDetailNotesFolder(settings, "Projects/Q3.md", "task", "Daily", neverCalled), "Detail Notes");
    assert.equal(resolveDetailNotesFolder(settings, "Team/Meetings.md", "event", null, neverCalled), "Detail Notes");
});

test('"sourceFolder" strategy uses the ledger note\'s own folder, falling back inside Daily Notes', () => {
    const settings = settingsWith({ detailNotesFolderStrategy: "sourceFolder", detailNotesFolder: "Detail Notes" });
    assert.equal(resolveDetailNotesFolder(settings, "Projects/Q3.md", "task", "Daily", neverCalled), "Projects");
    assert.equal(
        resolveDetailNotesFolder(settings, "Daily/2026-09-02.md", "event", "Daily", neverCalled),
        "Detail Notes",
    );
    assert.equal(resolveDetailNotesFolder(settings, "Daily.md", "task", null, neverCalled), "Detail Notes");
});

test('"perKind" strategy uses separate folders for Event and Task', () => {
    const settings = settingsWith({
        detailNotesFolderStrategy: "perKind",
        detailNotesFolderEvent: "Events/Detail",
        detailNotesFolderTask: "Tasks/Detail",
    });
    assert.equal(resolveDetailNotesFolder(settings, "Anywhere.md", "event", null, neverCalled), "Events/Detail");
    assert.equal(resolveDetailNotesFolder(settings, "Anywhere.md", "task", null, neverCalled), "Tasks/Detail");
});

test('"obsidianDefault" strategy delegates to the provided resolver only', () => {
    const settings = settingsWith({ detailNotesFolderStrategy: "obsidianDefault" });
    assert.equal(
        resolveDetailNotesFolder(settings, "Projects/Q3.md", "task", null, () => "Inbox/New"),
        "Inbox/New",
    );
});
