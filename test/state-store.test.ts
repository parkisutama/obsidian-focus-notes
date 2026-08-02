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

test("creates defaults on first install and reports a missing state", async () => {
    const writes: string[] = [];
    const store = new StateStore(fakeApp({ exists: false, writes }), mergeSettingsWithDefaults);

    const result = await store.load(async () => null);

    assert.equal(result.status, "missing");
    assert.equal(result.canSave, true);
    assert.equal(result.settings.pomodoroMinutes, DEFAULT_SETTINGS.pomodoroMinutes);
    assert.equal(writes.length, 1);
});

test("migrates legacy settings when the external state is missing", async () => {
    const writes: string[] = [];
    const store = new StateStore(fakeApp({ exists: false, writes }), mergeSettingsWithDefaults);

    const result = await store.load(async () => ({ pomodoroMinutes: 45 }));

    assert.equal(result.status, "migrated");
    assert.equal(result.settings.pomodoroMinutes, 45);
    assert.equal(JSON.parse(writes[0] ?? "{}").pomodoroMinutes, 45);
});

test("protects malformed state from automatic overwrite", async () => {
    const writes: string[] = [];
    const store = new StateStore(fakeApp({ exists: true, raw: "{broken", writes }), mergeSettingsWithDefaults);

    const result = await store.load(async () => null);
    const saved = await store.save({ ...result.settings, pomodoroMinutes: 50 });

    assert.equal(result.status, "malformed");
    assert.equal(result.canSave, false);
    assert.equal(saved, false);
    assert.deepEqual(writes, []);
});

test("distinguishes transient read failure and protects the existing file", async () => {
    const writes: string[] = [];
    const store = new StateStore(
        fakeApp({ exists: true, readError: new Error("temporarily unavailable"), writes }),
        mergeSettingsWithDefaults,
    );

    const result = await store.load(async () => null);
    const saved = await store.save(result.settings);

    assert.equal(result.status, "unreadable");
    assert.equal(result.canSave, false);
    assert.equal(saved, false);
    assert.deepEqual(writes, []);
});

test("serializes concurrent saves in call order from immutable snapshots", async () => {
    const writes: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const firstWriteGate = new Promise<void>((resolve) => {
        releaseFirst = resolve;
    });
    let writeNumber = 0;
    const app = fakeApp({ exists: false, writes });
    app.vault.adapter.write = async (_path, value) => {
        writeNumber += 1;
        if (writeNumber === 2) await firstWriteGate;
        writes.push(value);
    };
    const store = new StateStore(app, mergeSettingsWithDefaults);
    const loaded = await store.load(async () => null);
    writes.length = 0;

    const settings = loaded.settings;
    settings.pomodoroMinutes = 30;
    const first = store.save(settings);
    settings.pomodoroMinutes = 60;
    const second = store.save(settings);
    await Promise.resolve();
    assert.deepEqual(writes, []);
    releaseFirst?.();
    await Promise.all([first, second]);

    assert.deepEqual(
        writes.map((value) => JSON.parse(value).pomodoroMinutes),
        [30, 60],
    );
});

interface FakeStateOptions {
    exists: boolean;
    raw?: string;
    readError?: Error;
    writes: string[];
}

function fakeApp(options: FakeStateOptions) {
    return {
        vault: {
            configDir: ".obsidian",
            adapter: {
                exists: async () => options.exists,
                read: async () => {
                    if (options.readError) throw options.readError;
                    return options.raw ?? JSON.stringify({ pomodoroMinutes: 35 });
                },
                write: async (_path: string, value: string) => {
                    options.writes.push(value);
                },
            },
        },
    };
}
