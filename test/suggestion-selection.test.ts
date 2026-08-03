import assert from "node:assert/strict";
import test from "node:test";
import { applyInputSuggestion } from "../src/SuggestionSelection.ts";

test("suggestion selection notifies both reactive input and persistence listeners", () => {
    const events: string[] = [];
    const input = {
        value: "",
        trigger: (eventName: "input" | "change") => events.push(eventName),
    };

    applyInputSuggestion(input, "persona");

    assert.equal(input.value, "persona");
    assert.deepEqual(events, ["input", "change"]);
});
