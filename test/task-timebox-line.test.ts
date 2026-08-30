import assert from "node:assert/strict";
import test from "node:test";
import {
    createPlannedTaskTimebox,
    formatTaskTimeboxLine,
    parseTaskTimeboxLine,
} from "../src/features/capture/scheduled-item/domain/TaskTimeboxLine.ts";

test("formats and parses a planned timebox line round trip", () => {
    const line = formatTaskTimeboxLine({
        timeboxId: "timebox-abc1234567",
        start: "2026-08-31 09:00",
        end: "2026-08-31 11:00",
        status: "planned",
    });
    assert.equal(
        line,
        "  - timebox | start:2026-08-31 09:00 | end:2026-08-31 11:00 | status:planned ^timebox-abc1234567",
    );
    assert.deepEqual(parseTaskTimeboxLine(line), {
        status: "parsed",
        timebox: {
            timeboxId: "timebox-abc1234567",
            start: "2026-08-31 09:00",
            end: "2026-08-31 11:00",
            status: "planned",
        },
    });
});

test("a cross-midnight timebox is valid", () => {
    const line = formatTaskTimeboxLine({
        timeboxId: "timebox-abc1234567",
        start: "2026-08-31 22:00",
        end: "2026-09-01 02:00",
        status: "planned",
    });
    assert.equal(parseTaskTimeboxLine(line).status, "parsed");
});

test("a timebox line missing its identity fails explicitly instead of being silently accepted", () => {
    assert.deepEqual(
        parseTaskTimeboxLine("  - timebox | start:2026-08-31 09:00 | end:2026-08-31 11:00 | status:planned"),
        { status: "invalid", reason: "missing-id" },
    );
});

test("an unrecognized status fails explicitly", () => {
    assert.deepEqual(
        parseTaskTimeboxLine(
            "  - timebox | start:2026-08-31 09:00 | end:2026-08-31 11:00 | status:done ^timebox-abc1234567",
        ),
        { status: "invalid", reason: "invalid-status" },
    );
});

test("end before or equal to start fails explicitly", () => {
    assert.deepEqual(
        parseTaskTimeboxLine(
            "  - timebox | start:2026-08-31 11:00 | end:2026-08-31 09:00 | status:planned ^timebox-abc1234567",
        ),
        { status: "invalid", reason: "invalid-interval" },
    );
});

test("a non-timebox line is reported as not-timebox rather than invalid", () => {
    assert.deepEqual(parseTaskTimeboxLine("  - Some other bullet"), { status: "not-timebox" });
});

test("createPlannedTaskTimebox mints a fresh planned timebox from a given interval", () => {
    const timebox = createPlannedTaskTimebox("2026-08-31 09:00", "2026-08-31 11:00", () => "timebox-fixedfixed");
    assert.deepEqual(timebox, {
        timeboxId: "timebox-fixedfixed",
        start: "2026-08-31 09:00",
        end: "2026-08-31 11:00",
        status: "planned",
    });
});
