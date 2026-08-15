import assert from "node:assert/strict";
import test from "node:test";
import { promoteScheduledItemDetail, retryDetailNoteAttachment } from "../src/DetailNotePromotion.ts";
import type { ScheduledItemFormData } from "../src/ScheduledItemFormData.ts";

function task(detailNote: ScheduledItemFormData["detailNote"]): ScheduledItemFormData {
    return {
        kind: "task",
        title: "Prepare invoice",
        description: "Coordinate with @{People/Rachel.md}",
        objectReferences: [{ label: "Rachel", vaultPath: "People/Rachel.md" }],
        detailNote,
        completed: false,
        priority: "high",
        due: "2026-08-25 17:00",
        timebox: null,
        reminders: ["2026-08-25 16:00"],
    };
}

test("supports None and Link existing without creating a file", async () => {
    const attachments: unknown[] = [];
    let creates = 0;
    const dependencies = {
        targetPath: "Tasks.md",
        findDetailNote: (path: string) => ({ path }),
        createDetailNote: async () => {
            creates += 1;
            return { path: "unused.md" };
        },
        attachDetail: async (attachment: unknown) => attachments.push(attachment),
    };

    assert.deepEqual(await promoteScheduledItemDetail(task({ mode: "none" }), dependencies), {
        status: "success",
        detailPath: null,
    });
    assert.deepEqual(
        await promoteScheduledItemDetail(task({ mode: "link", path: "Details/Invoice.md" }), dependencies),
        { status: "success", detailPath: "Details/Invoice.md" },
    );
    assert.equal(creates, 0);
    assert.deepEqual(attachments, [null, { title: "Prepare invoice", path: "Details/Invoice.md" }]);
});

test("creates Task and Event detail notes through the existing record contract", async () => {
    const records: Array<{ kind: string; title: string; description: string }> = [];
    const attachments: unknown[] = [];
    const dependencies = {
        targetPath: "Projects/Alpha.md",
        findDetailNote: (path: string) => ({ path }),
        createDetailNote: async (
            _name: string,
            record: { kind: string; title: string; description: string },
            _folder: string,
            _targetPath: string,
            _hubPath: string | null,
        ) => {
            records.push({ kind: record.kind, title: record.title, description: record.description });
            return { path: `Details/${record.kind}.md` };
        },
        attachDetail: async (attachment: unknown) => attachments.push(attachment),
    };

    const event: ScheduledItemFormData = {
        kind: "event",
        title: "Project review",
        description: "Review scope",
        objectReferences: [],
        detailNote: { mode: "create", name: "Review detail", folder: "Details" },
        allDay: false,
        start: "2026-08-26 09:00",
        end: "2026-08-26 10:30",
        status: "completed",
        actual: { start: "2026-08-26 09:05", end: "2026-08-26 10:20" },
    };

    assert.equal(
        (
            await promoteScheduledItemDetail(
                task({ mode: "create", name: "Invoice detail", folder: "Details" }),
                dependencies,
            )
        ).status,
        "success",
    );
    assert.equal((await promoteScheduledItemDetail(event, dependencies)).status, "success");
    assert.deepEqual(records, [
        { kind: "task", title: "Prepare invoice", description: "Coordinate with @{People/Rachel.md}" },
        { kind: "event", title: "Project review", description: "Review scope" },
    ]);
    assert.deepEqual(attachments, [
        { title: "Prepare invoice", path: "Details/task.md" },
        { title: "Project review", path: "Details/event.md" },
    ]);
});

test("retains a created note and retries only its failed attachment", async () => {
    let creates = 0;
    let attaches = 0;
    const result = await promoteScheduledItemDetail(
        task({ mode: "create", name: "Invoice detail", folder: "Details" }),
        {
            targetPath: "Tasks.md",
            findDetailNote: (path: string) => ({ path }),
            createDetailNote: async () => {
                creates += 1;
                return { path: "Details/Invoice detail.md" };
            },
            attachDetail: async () => {
                attaches += 1;
                throw new Error("source changed");
            },
        },
    );

    assert.equal(result.status, "partial");
    if (result.status !== "partial") return;
    assert.equal(creates, 1);
    assert.equal(attaches, 1);
    assert.equal(result.detailPath, "Details/Invoice detail.md");

    const recovered = await retryDetailNoteAttachment(result, async (attachment) => {
        attaches += 1;
        assert.deepEqual(attachment, { title: "Prepare invoice", path: "Details/Invoice detail.md" });
    });
    assert.deepEqual(recovered, { status: "success", detailPath: "Details/Invoice detail.md" });
    assert.equal(creates, 1);
    assert.equal(attaches, 2);
});

test("does not attach when detail-note creation fails", async () => {
    let attaches = 0;
    const result = await promoteScheduledItemDetail(
        task({ mode: "create", name: "Invoice detail", folder: "Details" }),
        {
            targetPath: "Tasks.md",
            findDetailNote: (path: string) => ({ path }),
            createDetailNote: async () => {
                throw new Error("vault is read-only");
            },
            attachDetail: async () => {
                attaches += 1;
            },
        },
    );

    assert.deepEqual(result, {
        status: "failure",
        phase: "create",
        message: "Failed to create Detail Note: vault is read-only",
    });
    assert.equal(attaches, 0);
});

test("rejects Link existing when the selected vault path is missing", async () => {
    let attaches = 0;
    const result = await promoteScheduledItemDetail(task({ mode: "link", path: "Details/Missing.md" }), {
        targetPath: "Tasks.md",
        findDetailNote: () => null,
        createDetailNote: async () => ({ path: "unused.md" }),
        attachDetail: async () => {
            attaches += 1;
        },
    });

    assert.deepEqual(result, {
        status: "failure",
        phase: "validation",
        message: "Selected Detail Note does not exist.",
    });
    assert.equal(attaches, 0);
});
