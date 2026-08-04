import assert from "node:assert/strict";
import test from "node:test";
import type { App } from "obsidian";
import { ScheduledItemIndexer } from "../src/ScheduledItemIndexer.ts";
import { ScheduledItemParser } from "../src/ScheduledItemParser.ts";

test("indexes only scheduled records under an accepted ledger heading", async () => {
    const daily = {
        path: "calendar/2026/2026-08-03.md",
        basename: "2026-08-03",
        extension: "md",
        stat: {},
    };
    const outside = { path: "Archive/Plan.md", basename: "Plan", extension: "md", stat: {} };
    const app = {
        vault: {
            getMarkdownFiles: () => [daily, outside],
            cachedRead: async (file: { path: string }) =>
                file.path === daily.path
                    ? [
                          "## Activities & Tasks",
                          "- 2026-08-03 09:00 - 10:00 Review proposal",
                          "- [ ] Prepare report | start:2026-08-03 13:00 | end:2026-08-03 15:00 | due:2026-08-03",
                          "- [ ] Submit invoice | due:2026-08-03",
                          "- [ ] Ordinary checklist item",
                          "## Journal",
                          "- [ ] Journal checkbox | due:2026-08-03",
                          "- 2026-08-03 16:00 - 17:00 Journal-like timestamp",
                      ].join("\n")
                    : "- 2026-08-03 11:00 - 12:00 Must remain outside",
        },
    } as unknown as App;

    const items = await new ScheduledItemIndexer(app, new ScheduledItemParser()).buildIndex(
        [{ id: "daily-notes", name: "Daily Notes", folders: ["calendar"], filter: null }],
        ["Activities & Tasks"],
    );

    assert.deepEqual(
        items.map((item) => [item.kind, item.title, item.source.groupId, item.source.filePath]),
        [
            ["event", "Review proposal", "daily-notes", daily.path],
            ["task", "Prepare report", "daily-notes", daily.path],
            ["task", "Submit invoice", "daily-notes", daily.path],
        ],
    );
});

test("uses the most specific configured source group while preserving the exact source note", async () => {
    const file = {
        path: "Persona/Work/Projects/G2/Activities/Inspection.md",
        basename: "Inspection",
        extension: "md",
        stat: {},
    };
    const app = {
        vault: {
            getMarkdownFiles: () => [file],
            cachedRead: async () => "## Activities & Tasks\n- [ ] Inspect block | due:2026-08-03",
        },
    } as unknown as App;

    const items = await new ScheduledItemIndexer(app, new ScheduledItemParser()).buildIndex(
        [
            { id: "projects", name: "Projects", folders: ["Persona/Work/Projects"], filter: null },
            { id: "g2", name: "G2", folders: ["Persona/Work/Projects/G2"], filter: null },
        ],
        ["Activities & Tasks"],
    );

    assert.equal(items[0]?.source.groupId, "g2");
    assert.equal(items[0]?.source.groupName, "G2");
    assert.equal(items[0]?.source.filePath, file.path);
});

test("classifies Project and Activity notes by property when they share the Persona folder", async () => {
    const project = {
        path: "persona/Karyawan IAT/BLOK 05/BLOK 05.md",
        basename: "BLOK 05",
        extension: "md",
        stat: {},
    };
    const activity = {
        path: "persona/Karyawan IAT/BLOK 05/Quality Control.md",
        basename: "Quality Control",
        extension: "md",
        stat: {},
    };
    const app = {
        vault: {
            getMarkdownFiles: () => [project, activity],
            cachedRead: async (file: { path: string }) =>
                file.path === project.path
                    ? "## Activity and tasks\n- [ ] Final data | due:2026-08-04"
                    : "## Activity and tasks\n- 2026-08-04 09:00 - 10:00 Quality review",
        },
        metadataCache: {
            getFileCache: (file: { path: string }) => ({
                frontmatter: { type: file.path === project.path ? "project" : "activity" },
            }),
        },
    } as unknown as App;

    const items = await new ScheduledItemIndexer(app, new ScheduledItemParser()).buildIndex(
        [
            {
                id: "object:projects",
                name: "Projects",
                folders: ["persona"],
                filter: { property: "type", value: "project" },
            },
            {
                id: "object:activities",
                name: "Activities",
                folders: ["persona"],
                filter: { property: "type", value: "activity" },
            },
        ],
        ["Activity and tasks"],
    );

    assert.deepEqual(
        items.map((item) => [item.title, item.source.groupId, item.source.filePath]),
        [
            ["Final data", "object:projects", project.path],
            ["Quality review", "object:activities", activity.path],
        ],
    );
});
