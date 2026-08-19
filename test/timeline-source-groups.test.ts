import assert from "node:assert/strict";
import test from "node:test";
import type { ScheduledItem } from "../src/ScheduledItemTypes.ts";
import {
    assessTimelineTargetGroups,
    buildTimelineSourceGroups,
    timelineSourceHeadings,
} from "../src/TimelineSourceGroups.ts";
import { buildTimelineSourceSummaries } from "../src/TimelineSourceSidebar.ts";

test("groups every Daily Note under one stable Daily Notes source", () => {
    assert.deepEqual(buildTimelineSourceGroups(["Projects", "calendar"], "calendar", []), [
        { id: "folder:Projects", name: "Projects", folders: ["Projects"], filter: null },
        { id: "daily-notes:calendar", name: "Daily Notes", folders: ["calendar"], filter: null },
    ]);
});

test("keeps nested configured folders as distinct source groups", () => {
    assert.deepEqual(buildTimelineSourceGroups(["Persona/Work/Projects", "Persona/Work/Projects/G2"], null, []), [
        { id: "folder:Persona/Work/Projects", name: "Projects", folders: ["Persona/Work/Projects"], filter: null },
        { id: "folder:Persona/Work/Projects/G2", name: "G2", folders: ["Persona/Work/Projects/G2"], filter: null },
    ]);
});

test("builds property-filtered Timeline groups from temporal Object Sources sharing a Persona root", () => {
    const objectSources = [
        {
            id: "projects",
            name: "Projects",
            icon: "briefcase",
            folders: ["persona"],
            filter: { property: "type", value: "project" },
            relatedHeading: "Project log",
            templatePath: "",
            placement: "folder-note" as const,
            enabled: true,
            includeInTimeline: true,
        },
        {
            id: "activities",
            name: "Activities",
            icon: "activity",
            folders: ["persona"],
            filter: { property: "type", value: "activity" },
            relatedHeading: "Activity log",
            templatePath: "",
            placement: "flat" as const,
            enabled: true,
            includeInTimeline: true,
        },
        {
            id: "people",
            name: "People",
            icon: "user",
            folders: ["persona"],
            filter: { property: "type", value: "person" },
            relatedHeading: "Interactions",
            templatePath: "",
            placement: "flat" as const,
            enabled: true,
            includeInTimeline: false,
        },
    ];

    assert.deepEqual(buildTimelineSourceGroups([], null, objectSources), [
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
    ]);
});

test("target alignment requires the Object Source property while Daily Notes remain folder-based", () => {
    const groups = [
        {
            id: "daily-notes:calendar",
            name: "Daily Notes",
            folders: ["calendar"],
            filter: null,
        },
        {
            id: "object:projects",
            name: "Projects",
            folders: ["persona"],
            filter: { property: "type", value: "project" },
        },
    ];

    assert.equal(assessTimelineTargetGroups("calendar/2026-08-04.md", undefined, groups), "aligned");
    assert.equal(
        assessTimelineTargetGroups("persona/Karyawan/BLOK 05/BLOK 05.md", { type: "project" }, groups),
        "aligned",
    );
    assert.equal(
        assessTimelineTargetGroups("persona/Karyawan/BLOK 05/BLOK 05.md", { type: "person" }, groups),
        "mismatch",
    );
});

test("always includes the active capture headings without duplicating configured headings", () => {
    assert.deepEqual(timelineSourceHeadings(["Activities & Tasks", "Work Log"], ["Activities & Tasks"]), [
        "Activities & Tasks",
        "Work Log",
    ]);
    assert.deepEqual(timelineSourceHeadings([], ["Custom Ledger"]), ["Custom Ledger"]);
    assert.deepEqual(timelineSourceHeadings(["Agenda"], ["Agenda", "Task List"]), ["Agenda", "Task List"]);
});

test("summarizes many Daily Note files as one range-aware source", () => {
    const groups = buildTimelineSourceGroups([], "calendar", []);
    const makeItem = (id: string, filePath: string): ScheduledItem => ({
        id,
        kind: "task",
        title: id,
        start: null,
        end: null,
        due: new Date(2026, 7, 3),
        dueHasTime: false,
        remind: null,
        priority: "normal",
        eventStatus: null,
        actualStart: null,
        actualEnd: null,
        allDay: false,
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
            scope: "calendar",
            count: 2,
            color: "teal",
            visible: true,
        },
    ]);
});
