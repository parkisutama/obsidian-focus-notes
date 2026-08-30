import assert from "node:assert/strict";
import test from "node:test";
import { migrateLegacyTaskTimebox } from "../src/features/capture/scheduled-item/domain/TaskTimeboxMigration.ts";

test("migrates a legacy single-line start/end Task into one planned child timebox", () => {
    const line = "- [ ] Menyusun laporan | due:2026-09-03 | start:2026-08-31 09:00 | end:2026-08-31 11:00 ^task-def456";
    const result = migrateLegacyTaskTimebox(line, [], () => "timebox-migratedid");
    assert.deepEqual(result, {
        status: "migrated",
        firstLine: "- [ ] Menyusun laporan | due:2026-09-03 ^task-def456",
        timebox: {
            timeboxId: "timebox-migratedid",
            start: "2026-08-31 09:00",
            end: "2026-08-31 11:00",
            status: "planned",
        },
    });
});

test("a Task with no legacy timebox fields is left unchanged", () => {
    const line = "- [ ] Menyusun laporan | due:2026-09-03 ^task-def456";
    assert.deepEqual(migrateLegacyTaskTimebox(line, []), { status: "unchanged" });
});

test("migration is idempotent: a Task that already has a child timebox is never migrated again", () => {
    const line = "- [ ] Menyusun laporan | due:2026-09-03 | start:2026-08-31 09:00 | end:2026-08-31 11:00 ^task-def456";
    const existing = [
        {
            timeboxId: "timebox-existingid",
            start: "2026-08-31 09:00",
            end: "2026-08-31 11:00",
            status: "planned" as const,
        },
    ];
    assert.deepEqual(migrateLegacyTaskTimebox(line, existing), { status: "unchanged" });
});

test("an unparsable line fails explicitly instead of guessing", () => {
    assert.deepEqual(migrateLegacyTaskTimebox("Not a task line", []), { status: "invalid" });
});

test("cross-day legacy Task timebox migrates losslessly, keeping the same interval", () => {
    const line = "- [ ] Overnight shift | start:2026-08-31 22:00 | end:2026-09-01 06:00 ^task-abc123";
    const result = migrateLegacyTaskTimebox(line, [], () => "timebox-migratedid");
    assert.equal(result.status, "migrated");
    if (result.status !== "migrated") return;
    assert.equal(result.timebox.start, "2026-08-31 22:00");
    assert.equal(result.timebox.end, "2026-09-01 06:00");
    assert.equal(result.firstLine, "- [ ] Overnight shift ^task-abc123");
});
