import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/**
 * `TargetResolver`/`EventTaskWriter.formatDailyLink` depend on `app.fileManager`, which has no
 * runtime outside real Obsidian (see tasks/moment-weekly-target-plan.md's round-1 note), so this
 * can't be exercised end to end under `node --test`. Source-text wiring check instead, matching
 * this repo's existing pattern (see test/timer-canonical-focus-session-wiring.test.ts) — confirms
 * the desktop/mobile Moment screens wrap a dated per-period heading as a Daily Note link before
 * it reaches the writer/preview, without touching the editable Heading field's own value.
 */
for (const [label, path] of [
    ["desktop", "../src/features/capture/moment/ui/desktop/EventTaskModal.ts"],
    ["mobile", "../src/features/capture/moment/ui/mobile/EventTaskMobileScreen.ts"],
] as const) {
    test(`Moment's ${label} resolveInboxTarget wraps a dated heading as a Daily Note link`, async () => {
        const source = await readFile(new URL(path, import.meta.url), "utf8");
        assert.match(source, /if \(!target \|\| !this\.momentUsesDatedHeading\(\)\) return target;/);
        assert.match(source, /writer\.formatDailyLink\(this\.form\.inboxCapturedAt, target\.file, target\.heading\)/);
        // The editable Heading field's initial value must stay untouched by this wrapping — it's
        // seeded from selectInboxTarget()'s own separate, unwrapped result at construction time.
        assert.match(source, /inboxHeading: inboxTarget\?\.heading \?\? settings\.captureMoment\.heading,/);
    });
}
