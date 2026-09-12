import assert from "node:assert/strict";
import test from "node:test";
import type { App, TFile } from "obsidian";
import { RequiredPropertyRepairWatcher } from "../src/infrastructure/obsidian/object-notes/RequiredPropertyRepairWatcher.ts";
import { WriteSuppressionTracker } from "../src/infrastructure/obsidian/capture/WriteSuppressionTracker.ts";
import type { ContextSourceSettings } from "../src/features/object-notes/domain/ContextSourceSettings.ts";

function makeFile(path: string, extension = "md"): TFile {
    return {
        path,
        basename: path.split("/").pop(),
        extension,
        stat: { ctime: Date.UTC(2026, 7, 3, 14, 5) },
    } as unknown as TFile;
}

const placesSource: ContextSourceSettings = {
    id: "places",
    name: "Places",
    icon: "map-pin",
    folders: ["Objects/Places"],
    requiredProperties: [
        { property: "type", identityValue: "place", defaultValue: "place" },
        { property: "region", identityValue: null, defaultValue: "unknown" },
    ],
    matchByFolder: true,
    matchByProperty: true,
    relatedHeading: "Related log",
    relatedPosition: "start",
    templatePath: "",
    placement: "flat",
    enabled: true,
    includeInTimeline: false,
};

test("fills missing properties for a note matching an enabled source", async () => {
    const file = makeFile("Objects/Places/Kantor.md");
    const written: Record<string, unknown>[] = [];
    const app = {
        metadataCache: { getFileCache: () => ({ frontmatter: { type: "place" } }) },
        fileManager: {
            processFrontMatter: async (_f: TFile, mutate: (value: Record<string, unknown>) => void) => {
                const frontmatter: Record<string, unknown> = { type: "place" };
                mutate(frontmatter);
                written.push(frontmatter);
            },
        },
    } as unknown as App;
    const watcher = new RequiredPropertyRepairWatcher(app, () => [placesSource], new WriteSuppressionTracker());

    await watcher.handleFile(file);

    assert.deepEqual(written, [{ type: "place", region: "unknown" }]);
});

test("does nothing for a non-Markdown file", async () => {
    let calls = 0;
    const app = {
        metadataCache: { getFileCache: () => ({ frontmatter: {} }) },
        fileManager: { processFrontMatter: async () => (calls += 1) },
    } as unknown as App;
    const watcher = new RequiredPropertyRepairWatcher(app, () => [placesSource], new WriteSuppressionTracker());

    await watcher.handleFile(makeFile("Objects/Places/image.png", "png"));

    assert.equal(calls, 0);
});

test("does nothing for a note that matches no enabled source", async () => {
    let calls = 0;
    const app = {
        metadataCache: { getFileCache: () => ({ frontmatter: {} }) },
        fileManager: { processFrontMatter: async () => (calls += 1) },
    } as unknown as App;
    const watcher = new RequiredPropertyRepairWatcher(app, () => [placesSource], new WriteSuppressionTracker());

    await watcher.handleFile(makeFile("Archive/Old.md"));

    assert.equal(calls, 0);
});

test("does nothing when the schema is already satisfied", async () => {
    let calls = 0;
    const app = {
        metadataCache: { getFileCache: () => ({ frontmatter: { type: "place", region: "Jakarta" } }) },
        fileManager: { processFrontMatter: async () => (calls += 1) },
    } as unknown as App;
    const watcher = new RequiredPropertyRepairWatcher(app, () => [placesSource], new WriteSuppressionTracker());

    await watcher.handleFile(makeFile("Objects/Places/Kantor.md"));

    assert.equal(calls, 0);
});

test("never re-enters while its own write is suppressed, avoiding an infinite modify loop", async () => {
    let calls = 0;
    const app = {
        metadataCache: { getFileCache: () => ({ frontmatter: { type: "place" } }) },
        fileManager: { processFrontMatter: async () => (calls += 1) },
    } as unknown as App;
    const tracker = new WriteSuppressionTracker();
    const watcher = new RequiredPropertyRepairWatcher(app, () => [placesSource], tracker);
    const file = makeFile("Objects/Places/Kantor.md");

    tracker.beginSuppress(file.path);
    await watcher.handleFile(file);
    tracker.endSuppress(file.path);

    assert.equal(calls, 0);
});
