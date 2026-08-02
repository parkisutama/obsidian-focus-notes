import assert from "node:assert/strict";
import test from "node:test";
import { normalizeDailyNoteFormat } from "../src/DailyNotePath.ts";

test("removes trailing separators that otherwise create a /.md target", () => {
    assert.equal(
        normalizeDailyNoteFormat("YYYY/YYYY-MM/YYYY-MM-DD/", "YYYY-MM-DD"),
        "YYYY/YYYY-MM/YYYY-MM-DD"
    );
});

test("falls back when the configured Daily Notes format is blank", () => {
    assert.equal(normalizeDailyNoteFormat(" / ", "YYYY-MM-DD"), "YYYY-MM-DD");
});
