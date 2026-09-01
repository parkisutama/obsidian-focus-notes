import assert from "node:assert/strict";
import test from "node:test";
import type { App } from "obsidian";
import { scanVaultForProjectionReconciliation } from "../src/infrastructure/obsidian/capture/ProjectionReconciliationScan.ts";

function file(path: string) {
    return { path, basename: path.split("/").pop()?.replace(/\.md$/, "") ?? path, extension: "md", stat: {} };
}

test("collects canonical Tasks with their due day and timeboxes", async () => {
    const taskFile = file("Tasks/Report.md");
    const app = {
        vault: {
            getMarkdownFiles: () => [taskFile],
            cachedRead: async () =>
                [
                    "- [ ] Menyusun laporan | due:2026-09-03 ^task-abc1234567",
                    "    - timebox: start:2026-08-31 09:00 | end:2026-08-31 11:00 | status:planned ^timebox-aaaaaaaaaa",
                ].join("\n"),
        },
        metadataCache: {
            getFileCache: () => ({
                blocks: { "task-abc1234567": { position: { start: { line: 0 } } } },
            }),
        },
    } as unknown as App;

    const result = await scanVaultForProjectionReconciliation(app, { resolveDailyFileDate: () => null });

    assert.equal(result.tasks.length, 1);
    assert.equal(result.tasks[0].canonicalTarget, "Tasks/Report.md#^task-abc1234567");
    assert.equal(result.tasks[0].dueDayKey, "2026-09-03");
    assert.equal(result.tasks[0].timeboxes.length, 1);
    assert.equal(result.tasks[0].timeboxes[0].timeboxId, "timebox-aaaaaaaaaa");
});

test("collects canonical Events with their touched day keys", async () => {
    const eventFile = file("Team.md");
    const app = {
        vault: {
            getMarkdownFiles: () => [eventFile],
            cachedRead: async () => "- 2026-09-01 09:00 - 12:00 Workshop ^event-abc1234567",
        },
        metadataCache: {
            getFileCache: () => ({
                blocks: { "event-abc1234567": { position: { start: { line: 0 } } } },
            }),
        },
    } as unknown as App;

    const result = await scanVaultForProjectionReconciliation(app, { resolveDailyFileDate: () => null });

    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].canonicalTarget, "Team.md#^event-abc1234567");
    assert.deepEqual(result.events[0].touchedDayKeys, ["2026-09-01"]);
});

test("collects existing Task and Event day references, resolving their day from the owning file", async () => {
    const dailyFile = file("Daily/2026-09-03.md");
    const app = {
        vault: {
            getMarkdownFiles: () => [dailyFile],
            cachedRead: async () =>
                [
                    "- [ ] Menyusun laporan | canonical:[[Tasks/Report.md#^task-abc1234567]] | due:true ^task-ref-aaaaaaaaaa",
                    "- 2026-09-03 09:00 - 10:00 Workshop | canonical:[[Team.md#^event-abc1234567]] ^event-ref-bbbbbbbbbb",
                ].join("\n"),
        },
        metadataCache: {
            getFileCache: () => ({
                blocks: {
                    "task-ref-aaaaaaaaaa": { position: { start: { line: 0 } } },
                    "event-ref-bbbbbbbbbb": { position: { start: { line: 1 } } },
                },
            }),
        },
    } as unknown as App;

    const result = await scanVaultForProjectionReconciliation(app, {
        resolveDailyFileDate: (path) => (path === dailyFile.path ? new Date(2026, 8, 3) : null),
    });

    assert.deepEqual(result.taskReferences, [
        {
            canonicalTarget: "Tasks/Report.md#^task-abc1234567",
            destinationPath: "Daily/2026-09-03.md",
            date: "2026-09-03",
            due: true,
            timeboxId: null,
        },
    ]);
    assert.deepEqual(result.eventReferences, [
        {
            canonicalTarget: "Team.md#^event-abc1234567",
            destinationPath: "Daily/2026-09-03.md",
            dayKey: "2026-09-03",
        },
    ]);
});

test("skips a reference whose owning file cannot be resolved to a date", async () => {
    const strayFile = file("Somewhere/Notes.md");
    const app = {
        vault: {
            getMarkdownFiles: () => [strayFile],
            cachedRead: async () =>
                "- [ ] Menyusun laporan | canonical:[[Tasks/Report.md#^task-abc1234567]] | due:true ^task-ref-aaaaaaaaaa",
        },
        metadataCache: {
            getFileCache: () => ({ blocks: { "task-ref-aaaaaaaaaa": { position: { start: { line: 0 } } } } }),
        },
    } as unknown as App;

    const result = await scanVaultForProjectionReconciliation(app, { resolveDailyFileDate: () => null });

    assert.deepEqual(result.taskReferences, []);
});

test("ignores files with no relevant block ids entirely", async () => {
    const app = {
        vault: {
            getMarkdownFiles: () => [file("Random.md")],
            cachedRead: async () => "- Just a plain bullet",
        },
        metadataCache: { getFileCache: () => ({}) },
    } as unknown as App;

    const result = await scanVaultForProjectionReconciliation(app, { resolveDailyFileDate: () => null });

    assert.deepEqual(result, { tasks: [], events: [], taskReferences: [], eventReferences: [] });
});
