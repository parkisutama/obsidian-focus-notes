import assert from "node:assert/strict";
import test from "node:test";
import { StateStore } from "../src/StateStore.ts";
import { DEFAULT_SETTINGS, mergeSettingsWithDefaults } from "../src/types.ts";

test("adds Inbox defaults when loading settings saved before Inbox existed", () => {
    const merged = mergeSettingsWithDefaults({
        pomodoroMinutes: 45,
        eventTask: { ...DEFAULT_SETTINGS.eventTask, hubNotesFolder: "Hubs" },
    });

    assert.equal(merged.pomodoroMinutes, 45);
    assert.equal(merged.eventTask.hubNotesFolder, "Hubs");
    assert.deepEqual(merged.inbox, DEFAULT_SETTINGS.inbox);
    assert.equal(merged.inbox.defaultTargetMode, "weekly-note");
    assert.equal(merged.inbox.weeklyNoteFolder, "Weekly");
    assert.equal(merged.inbox.weeklyNoteFormat, "GGGG-[W]WW");
    assert.equal(merged.inbox.weeklyHeadingFormat, "YYYY-MM-DD");
    assert.equal(merged.inbox.dailyBacklinkHeading, "Moments");
});

test("preserves an existing install's chosen Moment target mode across settings merges", () => {
    const merged = mergeSettingsWithDefaults({
        inbox: { ...DEFAULT_SETTINGS.inbox, defaultTargetMode: "daily-note" },
    });

    assert.equal(merged.inbox.defaultTargetMode, "daily-note");
});

test("merges new weekly-note Inbox fields onto a partially saved inbox object", () => {
    const merged = mergeSettingsWithDefaults({
        inbox: {
            defaultTargetMode: "event-task-target",
            heading: "Captures",
            position: "start",
            contextSources: [],
        } as never,
    });

    assert.equal(merged.inbox.defaultTargetMode, "event-task-target");
    assert.equal(merged.inbox.heading, "Captures");
    assert.equal(merged.inbox.weeklyNoteFolder, DEFAULT_SETTINGS.inbox.weeklyNoteFolder);
    assert.equal(merged.inbox.weeklyNoteFormat, DEFAULT_SETTINGS.inbox.weeklyNoteFormat);
    assert.equal(merged.inbox.weeklyHeadingFormat, DEFAULT_SETTINGS.inbox.weeklyHeadingFormat);
    assert.equal(merged.inbox.dailyBacklinkHeading, DEFAULT_SETTINGS.inbox.dailyBacklinkHeading);
});

test("seeds default Daily/Weekly periodical profiles and syncs Daily from core plugin by default", () => {
    const merged = mergeSettingsWithDefaults({ pomodoroMinutes: 45 });

    assert.equal(merged.periodicalNotes.syncDailyFromCorePlugin, true);
    assert.deepEqual(
        merged.periodicalNotes.profiles.map((profile) => profile.id),
        ["daily", "weekly"],
    );
    const daily = merged.periodicalNotes.profiles[0];
    assert.equal(daily?.fileFormat, "YYYY-MM-DD");
    assert.equal(daily?.headingFormat, "");
    const weekly = merged.periodicalNotes.profiles[1];
    assert.equal(weekly?.folder, "Weekly");
    assert.equal(weekly?.fileFormat, "GGGG-[W]WW");
    assert.equal(weekly?.headingFormat, "YYYY-MM-DD");
});

test("preserves a saved periodical profile list and clones it, not sharing mutable state", () => {
    const saved = {
        periodicalNotes: {
            syncDailyFromCorePlugin: false,
            profiles: [{ id: "daily", name: "Daily", folder: "Journal", fileFormat: "YYYY-MM-DD", headingFormat: "" }],
        },
    };
    const first = mergeSettingsWithDefaults(saved);
    const second = mergeSettingsWithDefaults(saved);

    assert.equal(first.periodicalNotes.syncDailyFromCorePlugin, false);
    assert.equal(first.periodicalNotes.profiles.length, 1);
    assert.equal(first.periodicalNotes.profiles[0]?.folder, "Journal");

    first.periodicalNotes.profiles[0].folder = "Changed";
    assert.equal(second.periodicalNotes.profiles[0]?.folder, "Journal");
});

test("defaults Focus session and Event capture to the daily periodical profile", () => {
    const merged = mergeSettingsWithDefaults({});

    assert.equal(merged.captureFocusSession.profileId, "daily");
    assert.equal(merged.captureFocusSession.heading, "Focus timeline");
    assert.equal(merged.captureFocusSession.position, "end");
    assert.equal(merged.captureEvent.profileId, "daily");
    assert.equal(merged.captureEvent.heading, "Activities & Tasks");
    assert.equal(merged.captureEvent.hubNotesFolder, "Notes");
});

test("preserves a saved Focus session / Event capture target across settings merges", () => {
    const merged = mergeSettingsWithDefaults({
        captureFocusSession: { profileId: "weekly", heading: "Sessions", position: "start" },
        captureEvent: { profileId: "weekly", heading: "Agenda", position: "start", hubNotesFolder: "Hubs" },
    });

    assert.equal(merged.captureFocusSession.profileId, "weekly");
    assert.equal(merged.captureFocusSession.heading, "Sessions");
    assert.equal(merged.captureEvent.profileId, "weekly");
    assert.equal(merged.captureEvent.hubNotesFolder, "Hubs");
});

test("clones Object Source state during settings merge", () => {
    const first = mergeSettingsWithDefaults({ inbox: { ...DEFAULT_SETTINGS.inbox } });
    const second = mergeSettingsWithDefaults({});

    first.inbox.contextSources[0]?.folders.push("Private");
    if (first.inbox.contextSources[2]?.filter) first.inbox.contextSources[2].filter.value = "changed";

    assert.deepEqual(second.inbox.contextSources[0]?.folders, ["People"]);
    assert.equal(second.inbox.contextSources[2]?.filter?.value, "activity");
    assert.deepEqual(DEFAULT_SETTINGS.inbox.contextSources[0]?.folders, ["People"]);
    assert.equal(DEFAULT_SETTINGS.inbox.contextSources[2]?.filter?.value, "activity");
});

test("uses Activities & Tasks only when no Event/Task heading was previously saved", () => {
    const fresh = mergeSettingsWithDefaults({});
    const legacyEmpty = mergeSettingsWithDefaults({
        eventTask: { ...DEFAULT_SETTINGS.eventTask, defaultSaveHeading: "" },
    });
    const customized = mergeSettingsWithDefaults({
        eventTask: { ...DEFAULT_SETTINGS.eventTask, defaultSaveHeading: "Plan" },
    });

    assert.equal(fresh.eventTask.defaultSaveHeading, "Activities & Tasks");
    assert.equal(legacyEmpty.eventTask.defaultSaveHeading, "");
    assert.equal(customized.eventTask.defaultSaveHeading, "Plan");
});

test("adds Timeline heading defaults while preserving custom source headings", () => {
    const legacy = mergeSettingsWithDefaults({
        timeline: { ...DEFAULT_SETTINGS.timeline, sourceHeadings: undefined } as never,
    });
    const customized = mergeSettingsWithDefaults({
        timeline: { ...DEFAULT_SETTINGS.timeline, sourceHeadings: ["Work Log"] },
    });

    assert.deepEqual(legacy.timeline.sourceHeadings, ["Activities & Tasks"]);
    assert.deepEqual(customized.timeline.sourceHeadings, ["Work Log"]);
});

test("loads standard plugin data as the canonical settings source", async () => {
    const saved: unknown[] = [];
    const store = new StateStore(
        fakeApp({ externalExists: true, externalRaw: JSON.stringify({ pomodoroMinutes: 60 }) }),
        mergeSettingsWithDefaults,
    );

    const result = await store.load(
        async () => ({ pomodoroMinutes: 45 }),
        async (settings) => saved.push(settings),
    );

    assert.equal(result.status, "loaded");
    assert.equal(result.settings.pomodoroMinutes, 45);
    assert.deepEqual(saved, []);
});

test("migrates the external state into standard plugin data when data.json is missing", async () => {
    const saved: unknown[] = [];
    const store = new StateStore(
        fakeApp({ externalExists: true, externalRaw: JSON.stringify({ pomodoroMinutes: 45 }) }),
        mergeSettingsWithDefaults,
    );

    const result = await store.load(
        async () => null,
        async (settings) => saved.push(settings),
    );

    assert.equal(result.status, "migrated");
    assert.equal(result.settings.pomodoroMinutes, 45);
    assert.equal((saved[0] as { pomodoroMinutes: number }).pomodoroMinutes, 45);
});

test("creates and persists defaults on first install", async () => {
    const saved: unknown[] = [];
    const store = new StateStore(fakeApp({ externalExists: false }), mergeSettingsWithDefaults);

    const result = await store.load(
        async () => null,
        async (settings) => saved.push(settings),
    );

    assert.equal(result.status, "missing");
    assert.equal(result.settings.pomodoroMinutes, DEFAULT_SETTINGS.pomodoroMinutes);
    assert.equal(saved.length, 1);
});

test("protects malformed external migration state from automatic overwrite", async () => {
    const saved: unknown[] = [];
    const store = new StateStore(fakeApp({ externalExists: true, externalRaw: "{broken" }), mergeSettingsWithDefaults);

    const result = await store.load(
        async () => null,
        async (settings) => saved.push(settings),
    );
    const didSave = await store.save({ ...result.settings, pomodoroMinutes: 50 });

    assert.equal(result.status, "malformed");
    assert.equal(result.canSave, false);
    assert.equal(didSave, false);
    assert.deepEqual(saved, []);
});

test("serializes standard plugin saves in call order from immutable snapshots", async () => {
    const saved: unknown[] = [];
    let releaseFirst: (() => void) | undefined;
    const firstWriteGate = new Promise<void>((resolve) => {
        releaseFirst = resolve;
    });
    let writeNumber = 0;
    const store = new StateStore(fakeApp({ externalExists: false }), mergeSettingsWithDefaults);
    const loaded = await store.load(
        async () => null,
        async (settings) => {
            writeNumber += 1;
            if (writeNumber === 2) await firstWriteGate;
            saved.push(settings);
        },
    );
    saved.length = 0;

    const settings = loaded.settings;
    settings.pomodoroMinutes = 30;
    const first = store.save(settings);
    settings.pomodoroMinutes = 60;
    const second = store.save(settings);
    await Promise.resolve();
    assert.deepEqual(saved, []);
    releaseFirst?.();
    await Promise.all([first, second]);

    assert.deepEqual(
        saved.map((value) => (value as { pomodoroMinutes: number }).pomodoroMinutes),
        [30, 60],
    );
});

interface FakeStateOptions {
    externalExists: boolean;
    externalRaw?: string;
    readError?: Error;
}

function fakeApp(options: FakeStateOptions) {
    return {
        vault: {
            configDir: ".obsidian",
            adapter: {
                exists: async () => options.externalExists,
                read: async () => {
                    if (options.readError) throw options.readError;
                    return options.externalRaw ?? "";
                },
            },
        },
    };
}
