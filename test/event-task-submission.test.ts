import assert from "node:assert/strict";
import test from "node:test";
import { EventTaskFormState } from "../src/EventTaskFormState.ts";
import { submitEventTask, submitInbox } from "../src/EventTaskSubmission.ts";

test("writes the primary record and created notes through a renderer-independent submission", async () => {
    const state = new EventTaskFormState(new Date(2026, 7, 1, 9, 0), {
        file: "Daily.md",
        heading: "Schedule",
        position: "end",
        hubNotesFolder: "Hub",
        detailNotesFolder: "Details",
    });
    state.kind = "event";
    state.title = "Planning";
    state.hubMode = "create";
    state.hubCreateName = "Planning hub";
    state.detailNoteEnabled = true;
    state.detailNoteName = "Planning detail";
    state.writeToHubNote = true;

    const writes: Array<{ path: string; hasDetail: boolean }> = [];
    const opened: string[] = [];
    const result = await submitEventTask(state, {
        defaultHubNotesFolder: "Default hub",
        defaultDetailNotesFolder: "Default details",
        resolveTargetFile: () => "Daily/2026-08-01.md",
        findMarkdownFile: () => null,
        openFile: (file) => opened.push(file.path),
        writer: {
            createHubNote: async () => ({ path: "Hub/Planning hub.md" }),
            createDetailNote: async () => ({ path: "Details/Planning detail.md" }),
            write: async (_record, path, _heading, _position, detail) => {
                writes.push({ path, hasDetail: Boolean(detail) });
            },
        },
    });

    assert.deepEqual(result, {
        status: "success",
        message: "Event saved.",
        createdNotes: {
            hubPath: "Hub/Planning hub.md",
            detailPath: "Details/Planning detail.md",
        },
    });
    assert.deepEqual(opened, ["Hub/Planning hub.md", "Details/Planning detail.md"]);
    assert.deepEqual(writes, [
        { path: "Daily/2026-08-01.md", hasDetail: true },
        { path: "Hub/Planning hub.md", hasDetail: true },
    ]);
});
test("returns a phase-specific failure without reporting success", async () => {
    const state = new EventTaskFormState(new Date(2026, 7, 1, 9, 0), {
        file: "Daily.md",
        heading: "Schedule",
        position: "end",
        hubNotesFolder: "Hub",
        detailNotesFolder: "Details",
    });
    state.kind = "event";
    state.title = "Planning";
    state.detailNoteEnabled = true;

    const result = await submitEventTask(state, {
        defaultHubNotesFolder: "Hub",
        defaultDetailNotesFolder: "Details",
        resolveTargetFile: () => "Daily.md",
        findMarkdownFile: () => null,
        openFile: () => undefined,
        writer: {
            createHubNote: async () => ({ path: "unused.md" }),
            createDetailNote: async () => {
                throw new Error("vault is read-only");
            },
            write: async () => undefined,
        },
    });

    assert.deepEqual(result, {
        status: "failure",
        phase: "detail-note",
        message: "Failed to create detail note: vault is read-only",
        createdNotes: { hubPath: null, detailPath: null },
    });
});

test("reports notes created before a primary-write failure", async () => {
    const state = new EventTaskFormState(new Date(2026, 7, 1, 9, 0), {
        file: "Daily.md",
        heading: "Schedule",
        position: "end",
        hubNotesFolder: "Hub",
        detailNotesFolder: "Details",
    });
    state.kind = "event";
    state.title = "Planning";
    state.hubMode = "create";
    state.detailNoteEnabled = true;

    const result = await submitEventTask(state, {
        defaultHubNotesFolder: "Hub",
        defaultDetailNotesFolder: "Details",
        resolveTargetFile: () => "Daily.md",
        findMarkdownFile: () => null,
        openFile: () => undefined,
        writer: {
            createHubNote: async () => ({ path: "Hub/Planning.md" }),
            createDetailNote: async () => ({ path: "Details/Planning.md" }),
            write: async () => {
                throw new Error("daily note is read-only");
            },
        },
    });

    assert.deepEqual(result, {
        status: "failure",
        phase: "primary",
        message: "Failed to save: daily note is read-only",
        createdNotes: {
            hubPath: "Hub/Planning.md",
            detailPath: "Details/Planning.md",
        },
    });
});

test("rejects invalid temporal state before invoking any writer operation", async () => {
    const state = new EventTaskFormState(new Date(2026, 7, 1, 9, 0), {
        file: "Daily.md",
        heading: "Schedule",
        position: "end",
        hubNotesFolder: "Hub",
        detailNotesFolder: "Details",
    });
    state.kind = "event";
    state.title = "Invalid event";
    state.eventEndTime = state.eventStartTime;
    let writerCalls = 0;

    const result = await submitEventTask(state, {
        defaultHubNotesFolder: "Hub",
        defaultDetailNotesFolder: "Details",
        resolveTargetFile: () => "Daily.md",
        findMarkdownFile: () => null,
        openFile: () => undefined,
        writer: {
            createHubNote: async () => {
                writerCalls += 1;
                return { path: "unused.md" };
            },
            createDetailNote: async () => {
                writerCalls += 1;
                return { path: "unused.md" };
            },
            write: async () => {
                writerCalls += 1;
            },
        },
    });

    assert.deepEqual(result, {
        status: "failure",
        phase: "validation",
        message: "Event end must be later than start.",
        createdNotes: { hubPath: null, detailPath: null },
    });
    assert.equal(writerCalls, 0);
});

test("returns partial with a failed-write receipt when the primary write committed", async () => {
    const state = new EventTaskFormState(new Date(2026, 7, 1, 9, 0), {
        file: "Daily.md",
        heading: "Schedule",
        position: "end",
        hubNotesFolder: "Hub",
        detailNotesFolder: "Details",
    });
    state.kind = "task";
    state.title = "Prepare report";
    state.hubMode = "link";
    state.hubLinkPath = "Projects/Reporting.md";
    state.writeToHubNote = true;

    const writes: string[] = [];
    const result = await submitEventTask(state, {
        defaultHubNotesFolder: "Hub",
        defaultDetailNotesFolder: "Details",
        resolveTargetFile: () => "Daily/2026-08-01.md",
        findMarkdownFile: (path) => ({ path }),
        openFile: () => undefined,
        writer: {
            createHubNote: async () => ({ path: "unused.md" }),
            createDetailNote: async () => ({ path: "unused.md" }),
            write: async (_record, path) => {
                writes.push(path);
                if (path === "Projects/Reporting.md") {
                    throw new Error("hub is read-only");
                }
            },
        },
    });

    assert.equal(result.status, "partial");
    if (result.status !== "partial") {
        return;
    }
    assert.equal(result.message, "Task saved, but related note failed: hub is read-only");
    assert.deepEqual(result.createdNotes, { hubPath: null, detailPath: null });
    assert.equal(result.primaryPath, "Daily/2026-08-01.md");
    assert.deepEqual(result.recovery.completedPaths, []);
    assert.equal(result.recovery.failedWrites.length, 1);
    const failedWrite = result.recovery.failedWrites[0];
    assert.equal(failedWrite?.destinationPath, "Projects/Reporting.md");
    assert.equal(failedWrite?.heading, "Schedule");
    assert.equal(failedWrite?.position, "end");
    assert.equal(failedWrite?.record.kind, "task");
    assert.deepEqual(failedWrite?.record.hubNoteRef, {
        title: "Prepare report",
        path: "Daily/2026-08-01.md",
    });
    assert.equal(failedWrite?.detailNoteRef, null);
    assert.equal(failedWrite?.errorMessage, "hub is read-only");
    assert.deepEqual(writes, ["Daily/2026-08-01.md", "Projects/Reporting.md"]);
});

test("writes Inbox once without invoking Event or Task note workflows", async () => {
    const state = new EventTaskFormState(new Date(2026, 7, 2, 9, 12), {
        file: "Planning.md",
        heading: "Schedule",
        position: "end",
        hubNotesFolder: "Hub",
        detailNotesFolder: "Details",
    });
    state.inboxTitle = "Capture idea";
    state.inboxBody = "Discuss with Andi";
    const writes: unknown[] = [];

    const result = await submitInbox(state, {
        resolveTarget: () => ({ file: "Daily/2026-08-02.md", heading: "Inbox", position: "start" }),
        writer: {
            writeInbox: async (record, file, heading, position) => {
                writes.push({ record, file, heading, position });
            },
        },
    });

    assert.deepEqual(result, {
        status: "success",
        message: "Inbox saved.",
        createdNotes: { hubPath: null, detailPath: null },
    });
    assert.equal(writes.length, 1);
    assert.deepEqual(writes[0], {
        record: state.buildInboxRecord(),
        file: "Daily/2026-08-02.md",
        heading: "Inbox",
        position: "start",
    });
});

test("does not write Inbox when the selected destination is unavailable", async () => {
    let wrote = false;
    const state = new EventTaskFormState(new Date(2026, 7, 2, 9, 12), {
        file: "Planning.md",
        heading: "Schedule",
        position: "end",
        hubNotesFolder: "Hub",
        detailNotesFolder: "Details",
    });

    const result = await submitInbox(state, {
        resolveTarget: () => null,
        writer: {
            writeInbox: async () => {
                wrote = true;
            },
        },
    });

    assert.deepEqual(result, {
        status: "failure",
        phase: "inbox",
        message: "Failed to save Inbox: Selected Inbox destination is unavailable.",
        createdNotes: { hubPath: null, detailPath: null },
    });
    assert.equal(wrote, false);
});

test("reports an Inbox writer failure without reporting success", async () => {
    const state = new EventTaskFormState(new Date(2026, 7, 2, 9, 12), {
        file: "Planning.md",
        heading: "Schedule",
        position: "end",
        hubNotesFolder: "Hub",
        detailNotesFolder: "Details",
    });

    const result = await submitInbox(state, {
        resolveTarget: () => ({ file: "Daily.md", heading: "Inbox", position: "end" }),
        writer: {
            writeInbox: async () => {
                throw new Error("vault is read-only");
            },
        },
    });

    assert.deepEqual(result, {
        status: "failure",
        phase: "inbox",
        message: "Failed to save Inbox: vault is read-only",
        createdNotes: { hubPath: null, detailPath: null },
    });
});
