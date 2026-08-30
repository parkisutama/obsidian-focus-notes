import assert from "node:assert/strict";
import test from "node:test";
import type { App } from "obsidian";
import { resolveCanonicalScheduledItemSource } from "../src/infrastructure/obsidian/capture/CanonicalScheduledItemResolver.ts";

function appWith(files: Record<string, string>): App {
    return {
        vault: {
            getAbstractFileByPath: (path: string) => (path in files ? { path, extension: "md", stat: {} } : null),
            cachedRead: async (file: { path: string }) => files[file.path],
        },
    } as unknown as App;
}

test("resolves a canonical target to its exact line", async () => {
    const app = appWith({
        "Projects/Report.md": ["# Report", "- [ ] Menyusun laporan | due:2026-09-03 ^task-def4567890"].join("\n"),
    });
    const result = await resolveCanonicalScheduledItemSource(app, "Projects/Report.md#^task-def4567890");
    assert.deepEqual(result, {
        status: "resolved",
        filePath: "Projects/Report.md",
        lineNumber: 2,
        rawLine: "- [ ] Menyusun laporan | due:2026-09-03 ^task-def4567890",
    });
});

test("reports an orphan when the target file does not exist", async () => {
    const app = appWith({});
    const result = await resolveCanonicalScheduledItemSource(app, "Projects/Missing.md#^task-def4567890");
    assert.deepEqual(result, { status: "orphan" });
});

test("reports an orphan when the file exists but the block id is gone", async () => {
    const app = appWith({ "Projects/Report.md": "- [ ] Renamed task ^task-other0000" });
    const result = await resolveCanonicalScheduledItemSource(app, "Projects/Report.md#^task-def4567890");
    assert.deepEqual(result, { status: "orphan" });
});

test("reports ambiguous when the block id appears on more than one line", async () => {
    const app = appWith({
        "Projects/Report.md": [
            "- [ ] Menyusun laporan ^task-def4567890",
            "- [ ] Duplicate somehow ^task-def4567890",
        ].join("\n"),
    });
    const result = await resolveCanonicalScheduledItemSource(app, "Projects/Report.md#^task-def4567890");
    assert.deepEqual(result, { status: "ambiguous" });
});

test("reports an invalid target for a malformed canonical string", async () => {
    const app = appWith({});
    const result = await resolveCanonicalScheduledItemSource(app, "not-a-valid-target");
    assert.deepEqual(result, { status: "invalid-target" });
});
