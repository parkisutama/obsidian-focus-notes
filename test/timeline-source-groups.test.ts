import assert from "node:assert/strict";
import test from "node:test";
import type { ScheduledItem } from "../src/ScheduledItemTypes.ts";
import { buildTimelineSourceGroups, timelineSourceHeadings } from "../src/TimelineSourceGroups.ts";
import { buildTimelineSourceSummaries } from "../src/TimelineSourceSidebar.ts";

test("groups every Daily Note under one stable Daily Notes source", () => {
    assert.deepEqual(buildTimelineSourceGroups(["Projects", "calendar"], "calendar"), [
        { id: "folder:Projects", name: "Projects", folder: "Projects" },
        { id: "daily-notes:calendar", name: "Daily Notes", folder: "calendar" },
    ]);
});

test("keeps nested configured folders as distinct source groups", () => {
    assert.deepEqual(buildTimelineSourceGroups(["Persona/Work/Projects", "Persona/Work/Projects/G2"], null), [
        { id: "folder:Persona/Work/Projects", name: "Projects", folder: "Persona/Work/Projects" },
        { id: "folder:Persona/Work/Projects/G2", name: "G2", folder: "Persona/Work/Projects/G2" },
    ]);
});

test("always includes the active capture heading without duplicating configured headings", () => {
    assert.deepEqual(timelineSourceHeadings(["Activities & Tasks", "Work Log"], "Activities & Tasks"), [
        "Activities & Tasks",
        "Work Log",
    ]);
    assert.deepEqual(timelineSourceHeadings([], "Custom Ledger"), ["Custom Ledger"]);
});

test("summarizes many Daily Note files as one range-aware source", () => {
    const groups = buildTimelineSourceGroups([], "calendar");
    const makeItem = (id: string, filePath: string): ScheduledItem => ({
        id,
        kind: "task",
        title: id,
        start: null,
        end: null,
        due: new Date(2026, 7, 3),
        dueHasTime: false,
        remind: null,
        isCompleted: false,
        source: {
            groupId: "daily-notes:calendar",
            groupName: "Daily Notes",
            filePath,
            fileName: filePath.split("/").pop() ?? filePath,
            lineNumber: 2,
            headingPath: ["Activities & Tasks"],
        },
        rawLine: "- [ ] Task | due:2026-08-03",
    });

    const first = makeItem("one", "calendar/2026-08-01.md");
    const second = makeItem("two", "calendar/2026-08-02.md");
    const summaries = buildTimelineSourceSummaries(groups, [first, second, first], {}, {}, () => "teal");

    assert.deepEqual(summaries, [
        {
            id: "daily-notes:calendar",
            name: "Daily Notes",
            folder: "calendar",
            count: 2,
            color: "teal",
            visible: true,
        },
    ]);
});
