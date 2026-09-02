import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Timer's Focus-on and What-are-you-doing fields are merged into one input with Task/Event/file suggestions", async () => {
    const selectorSource = await readFile(
        new URL("../src/features/focus-session/ui/TimerPurposeSelector.ts", import.meta.url),
        "utf8",
    );
    assert.match(selectorSource, /\.setName\("What are you doing\?"\)/);
    assert.match(selectorSource, /class TimerFocusSuggest extends AbstractInputSuggest<TimerFocusSuggestion>/);
    assert.match(selectorSource, /kind: "event" \| "task"; candidate: ScheduledItemMentionCandidate/);
    assert.match(selectorSource, /kind: "file"; file: TFile/);
    assert.match(selectorSource, /getFocusText\(\): string/);
    assert.match(selectorSource, /setFocusText\(value: string\): void/);
    // Picking a Task/Event still sets the resolved owner (Task 42's gate); a file pick doesn't.
    assert.match(selectorSource, /this\.selection =\s*\n\s*pick\.kind === "event"/);

    const controlsSource = await readFile(
        new URL("../src/features/focus-session/ui/TimerControls.ts", import.meta.url),
        "utf8",
    );
    assert.doesNotMatch(controlsSource, /renderFocusInput/);
    assert.doesNotMatch(controlsSource, /focus-notes-focus-row/);
    assert.match(controlsSource, /return this\.purposeSelector\.getFocusText\(\);/);
    assert.match(controlsSource, /this\.purposeSelector\.setFocusText\(value\);/);
});
