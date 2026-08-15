import assert from "node:assert/strict";
import test from "node:test";
import { activeNoteItemMeta, buildActiveNoteManagerModel } from "../src/ActiveNoteManagerModel.ts";
import type { ScheduledItem } from "../src/ScheduledItemTypes.ts";

function item(title: string, headingPath: string[], lineNumber: number, kind: "event" | "task"): ScheduledItem {
    return {
        id: `${kind}:${lineNumber}`,
        kind,
        title,
        start: null,
        end: null,
        due: null,
        dueHasTime: false,
        remind: null,
        priority: kind === "task" ? "normal" : null,
        eventStatus: kind === "event" ? "planned" : null,
        actualStart: null,
        actualEnd: null,
        allDay: false,
        isCompleted: false,
        source: {
            groupId: "active-note",
            groupName: "Active note",
            filePath: "Daily.md",
            fileName: "Daily.md",
            lineNumber,
            headingPath,
        },
        rawLine: "",
    };
}

test("groups active-note records by their nearest heading while preserving source order", () => {
    const task = item("Draft", ["Daily", "Activities & Tasks"], 5, "task");
    const event = item("Review", ["Daily", "Activities & Tasks", "Meetings"], 8, "event");
    const model = buildActiveNoteManagerModel("Daily.md", [task, event]);

    assert.equal(model.subtitle, "Daily.md");
    assert.deepEqual(
        model.groups.map((group) => ({ heading: group.heading, titles: group.items.map((entry) => entry.title) })),
        [
            { heading: "Activities & Tasks", titles: ["Draft"] },
            { heading: "Meetings", titles: ["Review"] },
        ],
    );
    assert.equal(activeNoteItemMeta(task), "Task · open · line 5");
    assert.equal(activeNoteItemMeta(event), "Event · planned · line 8");
});

test("provides an explicit empty state", () => {
    const model = buildActiveNoteManagerModel("Empty.md", []);
    assert.deepEqual(model.groups, []);
    assert.match(model.emptyMessage, /No Task or Event records/);
});
