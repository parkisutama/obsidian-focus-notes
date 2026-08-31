import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Timer's log workflow writes the canonical Focus Session before the daily log, with a retry on orphan", async () => {
    const source = await readFile(
        new URL("../src/features/focus-session/ui/TimerLogWorkflow.ts", import.meta.url),
        "utf8",
    );
    assert.match(
        source,
        /import \{\s*type WriteCanonicalFocusSessionResult,\s*writeCanonicalFocusSession,\s*\} from "\.\.\/\.\.\/\.\.\/infrastructure\/obsidian\/focus-session\/CanonicalFocusSessionWriter\.ts";/,
    );
    assert.match(source, /getCurrentOwner: \(\) => FocusSessionOwner \| null;/);
    assert.match(source, /const owner = this\.options\.getCurrentOwner\(\);/);
    assert.match(source, /const canonicalLink = owner\s*\n\s*\? await this\.recordCanonicalFocusSession\(/);
    assert.match(source, /const sessionId = createFocusSessionId\(\);/);
    assert.match(
        source,
        /if \(result\.status === "orphan"\) \{\s*this\.notifyOrphanedCanonicalWrite\(attempt, owner, startTime, endTime\);/,
    );
    assert.match(
        source,
        /if \(result\.status === "written"\) this\.projectOwnedSessionWeekly\(owner, startTime, endTime\);/,
    );
    assert.match(source, /canonicalLink,\s*\n\s*\};/);
});

test("Timer view supplies the resolved owner from TimerControls to the log workflow", async () => {
    const source = await readFile(new URL("../src/features/focus-session/ui/TimerView.ts", import.meta.url), "utf8");
    assert.match(source, /getCurrentOwner: \(\) => this\.controls\.getCurrentOwner\(\),/);
});

test("SessionRecord and NoteWriter carry the optional canonical link token", async () => {
    const recordSource = await readFile(
        new URL("../src/features/focus-session/domain/SessionRecord.ts", import.meta.url),
        "utf8",
    );
    assert.match(recordSource, /canonicalLink: string;/);

    const writerSource = await readFile(
        new URL("../src/infrastructure/obsidian/focus-session/NoteWriter.ts", import.meta.url),
        "utf8",
    );
    assert.match(writerSource, /"\{\{canonicalLink\}\}": record\.canonicalLink,/);
});
