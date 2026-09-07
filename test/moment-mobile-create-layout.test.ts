import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("mobile Moment uses the scheduled-item shell and keeps its generated title in More options", async () => {
    const screen = await readFile(
        new URL("../src/features/capture/moment/ui/mobile/EventTaskMobileScreen.ts", import.meta.url),
        "utf8",
    );
    const form = await readFile(
        new URL("../src/features/capture/moment/ui/mobile/InboxMobileForm.ts", import.meta.url),
        "utf8",
    );

    assert.match(screen, /fn-mobile-scheduled-title[^\n]+Create Moment/);
    assert.match(screen, /fn-mobile-scheduled-context/);
    assert.doesNotMatch(screen, /fn-mobile-event-title/);
    assert.match(form, /"Moment title", "Timestamp or custom title"/);
});

test("mobile Moment wellbeing is a closed disclosure with a live stress, emotion, and mood summary", async () => {
    const source = await readFile(
        new URL("../src/features/capture/moment/ui/mobile/InboxMobileForm.ts", import.meta.url),
        "utf8",
    );

    assert.match(source, /createEl\("details"/);
    assert.match(source, /createDiv\(\{ cls: "fn-mobile-moment-reflection" \}\)/);
    assert.doesNotMatch(source, /fn-mobile-event-disclosure-content fn-mobile-moment-reflection/);
    assert.match(source, /wellbeing\.open = false/);
    assert.match(source, /fn-wellbeing-disclosure-summary/);
    assert.match(source, /summaryValue\.setText\(this\.summarizeWellbeing\(\)\)/);
    assert.match(source, /Stress \$\{stress\}/);
    assert.match(source, /Emotion \$\{emotion\}/);
    assert.match(source, /Mood \$\{mood\.emoji\} \$\{mood\.name\}/);
    assert.doesNotMatch(source, /text: "Reflection"/);
});

test("mobile Event and Task wellbeing is closed by default", async () => {
    const source = await readFile(
        new URL("../src/features/capture/scheduled-item/ui/mobile/MobileReflectionSection.ts", import.meta.url),
        "utf8",
    );

    assert.match(source, /createEl\("details"/);
    assert.match(source, /wellbeing\.open = false/);
});
