import assert from "node:assert/strict";
import test from "node:test";
import { TimelineLayout } from "../src/TimelineLayout.ts";
import type { ScheduledItem } from "../src/ScheduledItemTypes.ts";

test("explicit all-day Events render in the all-day row instead of the hourly canvas", () => {
    const item: ScheduledItem = {
        id: "holiday",
        kind: "event",
        title: "Company holiday",
        start: new Date(2026, 7, 10),
        end: new Date(2026, 7, 11),
        due: null,
        dueHasTime: false,
        remind: null,
        priority: null,
        eventStatus: "planned",
        actualStart: null,
        actualEnd: null,
        allDay: true,
        isCompleted: false,
        source: {
            groupId: "daily-notes",
            groupName: "Daily Notes",
            filePath: "Daily/2026-08-10.md",
            fileName: "2026-08-10.md",
            lineNumber: 1,
            headingPath: ["Activities & Tasks"],
        },
        rawLine: "- 2026-08-10 Company holiday | type:event | all-day:true",
    };

    const layout = new TimelineLayout().build([item], {
        start: new Date(2026, 7, 10),
        end: new Date(2026, 7, 11),
    });

    assert.equal(layout.blocks.length, 0);
    assert.deepEqual(layout.dues, [{ itemId: "holiday", dayKey: "2026-08-10" }]);
});
