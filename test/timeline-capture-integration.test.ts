import assert from "node:assert/strict";
import test from "node:test";
import type { App } from "obsidian";
import { ScheduledItemIndexer } from "../src/ScheduledItemIndexer.ts";
import { ScheduledItemParser } from "../src/ScheduledItemParser.ts";

test("indexes Event, timeboxed Task, and due-only Task written to a Daily Notes source", async () => {
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
                      ].join("\n")
                    : "- 2026-08-03 11:00 - 12:00 Must remain outside",
        },
    } as unknown as App;

    const items = await new ScheduledItemIndexer(app, new ScheduledItemParser()).buildIndex(["calendar"]);

    assert.deepEqual(
        items.map((item) => [item.kind, item.title, item.source.filePath]),
        [
            ["event", "Review proposal", daily.path],
            ["task", "Prepare report", daily.path],
            ["task", "Submit invoice", daily.path],
        ],
    );
});
