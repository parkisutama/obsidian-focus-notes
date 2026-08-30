import assert from "node:assert/strict";
import test from "node:test";
import { ScheduledItemIdentityIndex } from "../src/features/capture/scheduled-item/application/ScheduledItemIdentityIndex.ts";
import type {
    CanonicalScheduledItemIdentity,
    ScheduledItemReferenceIdentity,
} from "../src/features/capture/scheduled-item/domain/ScheduledItemIdentity.ts";

const canonical = (
    itemId: string,
    filePath: string,
    lineNumber = 1,
    kind: "task" | "event" = "task",
): CanonicalScheduledItemIdentity => ({
    entryType: "canonical",
    itemId,
    kind,
    blockId: itemId,
    filePath,
    lineNumber,
});

const reference = (
    itemId: string,
    blockId: string,
    filePath: string,
    lineNumber = 1,
    kind: "task" | "event" = "task",
): ScheduledItemReferenceIdentity => ({
    entryType: "reference",
    itemId,
    kind,
    blockId,
    filePath,
    lineNumber,
    timeboxId: null,
    sessionId: null,
});

test("resolves a derived reference to one canonical item by stable itemId", () => {
    const index = new ScheduledItemIdentityIndex();
    index.replaceFile("Projects/Report.md", [canonical("task-0123456789", "Projects/Report.md", 8)]);
    index.replaceFile("Daily/2026-08-30.md", [
        reference("task-0123456789", "task-ref-abcdefghjk", "Daily/2026-08-30.md", 4),
    ]);

    assert.deepEqual(index.resolveReference("task-ref-abcdefghjk"), {
        status: "resolved",
        reference: reference("task-0123456789", "task-ref-abcdefghjk", "Daily/2026-08-30.md", 4),
        canonical: canonical("task-0123456789", "Projects/Report.md", 8),
    });
});

test("keeps references out of canonical counts and follows canonical file moves", () => {
    const index = new ScheduledItemIdentityIndex();
    const dailyReference = reference("event-0123456789", "event-ref-abcdefghjk", "Daily/2026-08-31.md", 5, "event");
    index.replaceFile("Daily/2026-08-30.md", [canonical("event-0123456789", "Daily/2026-08-30.md", 3, "event")]);
    index.replaceFile("Daily/2026-08-31.md", [dailyReference]);
    index.replaceFile("Daily/2026-08-30.md", []);
    index.replaceFile("Archive/Events.md", [canonical("event-0123456789", "Archive/Events.md", 12, "event")]);

    const result = index.resolveReference(dailyReference.blockId);
    assert.equal(result.status, "resolved");
    if (result.status === "resolved") assert.equal(result.canonical.filePath, "Archive/Events.md");
});

test("reports an orphan when a reference has no canonical item", () => {
    const index = new ScheduledItemIdentityIndex();
    const orphan = reference("task-0123456789", "task-ref-abcdefghjk", "Daily/2026-08-30.md", 2);
    index.replaceFile(orphan.filePath, [orphan]);

    assert.deepEqual(index.resolveReference(orphan.blockId), { status: "orphan", reference: orphan });
});

test("reports every candidate when canonical item identity is duplicated", () => {
    const index = new ScheduledItemIdentityIndex();
    const dailyReference = reference("task-0123456789", "task-ref-abcdefghjk", "Daily/2026-08-30.md", 2);
    index.replaceFile("Projects/A.md", [canonical("task-0123456789", "Projects/A.md", 1)]);
    index.replaceFile("Projects/B.md", [canonical("task-0123456789", "Projects/B.md", 7)]);
    index.replaceFile(dailyReference.filePath, [dailyReference]);

    assert.deepEqual(index.resolveReference(dailyReference.blockId), {
        status: "ambiguous",
        reference: dailyReference,
        canonicals: [
            canonical("task-0123456789", "Projects/A.md", 1),
            canonical("task-0123456789", "Projects/B.md", 7),
        ],
    });
});

test("returns missing-reference for an unknown reference block identity", () => {
    const index = new ScheduledItemIdentityIndex();
    assert.deepEqual(index.resolveReference("task-ref-0123456789"), { status: "missing-reference" });
});

test("does not choose arbitrarily when a reference block identity is duplicated", () => {
    const index = new ScheduledItemIdentityIndex();
    const first = reference("task-0123456789", "task-ref-abcdefghjk", "Daily/2026-08-30.md", 2);
    const second = reference("task-0123456789", "task-ref-abcdefghjk", "Daily/2026-08-31.md", 3);
    index.replaceFile(first.filePath, [first]);
    index.replaceFile(second.filePath, [second]);

    assert.deepEqual(index.resolveReference(first.blockId), {
        status: "ambiguous-reference",
        references: [first, second],
    });
});
