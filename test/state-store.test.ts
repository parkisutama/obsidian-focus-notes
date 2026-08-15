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
    assert.equal(merged.inbox.defaultTargetMode, "event-task-target");
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
