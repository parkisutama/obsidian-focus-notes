import assert from "node:assert/strict";
import test from "node:test";
import type { App, TFile } from "obsidian";
import { repairObjectNoteProperties } from "../src/infrastructure/obsidian/object-notes/RepairObjectNotes.ts";
import type { ContextSourceSettings } from "../src/features/object-notes/domain/ContextSourceSettings.ts";
import { assertAdditiveOnly, LINTER_FORMATTED_FRONTMATTER } from "./support/linter-formatted-frontmatter.ts";

function makeFile(path: string, basename: string): TFile {
    return { path, basename, extension: "md", stat: { ctime: Date.UTC(2026, 7, 3, 14, 5) } } as unknown as TFile;
}

function makeApp(
    files: TFile[],
    frontmatterByPath: Map<string, Record<string, unknown>>,
): { app: App; writes: Map<string, Record<string, unknown>> } {
    const writes = new Map<string, Record<string, unknown>>();
    const app = {
        vault: { getMarkdownFiles: () => files },
        metadataCache: {
            getFileCache: (file: TFile) => ({ frontmatter: frontmatterByPath.get(file.path) }),
        },
        fileManager: {
            processFrontMatter: async (file: TFile, mutate: (value: Record<string, unknown>) => void) => {
                const frontmatter = { ...(frontmatterByPath.get(file.path) ?? {}) };
                mutate(frontmatter);
                writes.set(file.path, frontmatter);
            },
        },
    } as unknown as App;
    return { app, writes };
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

const timelineSource: ContextSourceSettings = {
    ...placesSource,
    id: "timeline-tag",
    name: "Timeline tag",
    folders: ["Objects/Places"],
    requiredProperties: [
        { property: "region", identityValue: null, defaultValue: "unknown-from-timeline" },
        { property: "onTimeline", identityValue: null, defaultValue: "true" },
    ],
};

test("does nothing when no note needs repair", async () => {
    const file = makeFile("Objects/Places/Kantor.md", "Kantor");
    const { app, writes } = makeApp([file], new Map([[file.path, { type: "place", region: "Jakarta" }]]));

    const summary = await repairObjectNoteProperties(app, [placesSource]);

    assert.deepEqual(summary, { filesRepaired: 0, propertiesAdded: 0 });
    assert.equal(writes.size, 0);
});

test("fills every missing property for a single matched source", async () => {
    const file = makeFile("Objects/Places/Kantor.md", "Kantor");
    const { app, writes } = makeApp([file], new Map([[file.path, { type: "place" }]]));

    const summary = await repairObjectNoteProperties(app, [placesSource]);

    assert.deepEqual(summary, { filesRepaired: 1, propertiesAdded: 1 });
    assert.deepEqual(writes.get(file.path), { type: "place", region: "unknown" });
});

test("unions gaps across every matching enabled source, keeping the first source's value for a shared property", async () => {
    const file = makeFile("Objects/Places/Kantor.md", "Kantor");
    const { app, writes } = makeApp([file], new Map([[file.path, { type: "place" }]]));

    const summary = await repairObjectNoteProperties(app, [placesSource, timelineSource]);

    assert.deepEqual(summary, { filesRepaired: 1, propertiesAdded: 2 });
    assert.deepEqual(writes.get(file.path), { type: "place", region: "unknown", onTimeline: "true" });
});

test("never overwrites a value already present, even if stale metadata suggested a gap", async () => {
    const file = makeFile("Objects/Places/Kantor.md", "Kantor");
    const { app, writes } = makeApp([file], new Map([[file.path, { type: "place" }]]));
    (app.fileManager.processFrontMatter as unknown as (
        f: TFile,
        mutate: (v: Record<string, unknown>) => void,
    ) => Promise<void>) = async (f, mutate) => {
        const frontmatter: Record<string, unknown> = { type: "place", region: "already set by the user" };
        mutate(frontmatter);
        writes.set(f.path, frontmatter);
    };

    await repairObjectNoteProperties(app, [placesSource]);

    assert.equal(writes.get(file.path)?.region, "already set by the user");
});

test("only appends the missing gap, leaving Linter-formatted frontmatter otherwise untouched", async () => {
    const file = makeFile("Objects/Places/Kantor.md", "Kantor");
    const before = { type: "place", ...LINTER_FORMATTED_FRONTMATTER };
    const { app, writes } = makeApp([file], new Map([[file.path, before]]));

    await repairObjectNoteProperties(app, [placesSource]);

    assertAdditiveOnly(before, writes.get(file.path) ?? {}, ["region"]);
});

test("ignores disabled sources and notes that match no source", async () => {
    const file = makeFile("Archive/Old.md", "Old");
    const { app, writes } = makeApp([file], new Map([[file.path, {}]]));

    const summary = await repairObjectNoteProperties(app, [{ ...placesSource, enabled: false }]);

    assert.deepEqual(summary, { filesRepaired: 0, propertiesAdded: 0 });
    assert.equal(writes.size, 0);
});
