import assert from "node:assert/strict";
import test from "node:test";
import { EventTaskFormState } from "../src/EventTaskFormState.ts";
import { retryRelatedSubmission, submitEventTask, submitInbox } from "../src/EventTaskSubmission.ts";

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
            writeRelated: async (_markdown, path) => {
                writes.push({ path, hasDetail: true });
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
            },
            writeRelated: async (_markdown, path) => {
                writes.push(path);
                throw new Error("hub is read-only");
            },
        },
    });

    assert.equal(result.status, "partial");
    if (result.status !== "partial") {
        return;
    }
    assert.equal(result.message, "Task saved, but 1 related log write(s) failed: hub is read-only");
    assert.deepEqual(result.createdNotes, { hubPath: null, detailPath: null });
    assert.equal(result.primaryPath, "Daily/2026-08-01.md");
    assert.deepEqual(result.recovery.completedPaths, []);
    assert.equal(result.recovery.failedWrites.length, 1);
    const failedWrite = result.recovery.failedWrites[0];
    assert.equal(failedWrite?.destinationPath, "Projects/Reporting.md");
    assert.equal(failedWrite?.heading, "Schedule");
    assert.equal(failedWrite?.position, "end");
    assert.match(failedWrite?.markdown ?? "", /\[Prepare report\]\(Daily\/2026-08-01\.md\)/);
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

test("writes contextual Event logs after the primary and receipts only failed destinations", async () => {
    const state = new EventTaskFormState(new Date(2026, 7, 2, 9, 0), {
        file: "Daily.md",
        heading: "Activities & Tasks",
        position: "end",
        hubNotesFolder: "Hub",
        detailNotesFolder: "Details",
    });
    state.kind = "event";
    state.title = "Audit review";
    state.description = [
        "Meet [Andi](../People/Andi.md)",
        "at [Office](../Places/Office.md)",
        "for [Audit](../Activities/Audit.md)",
    ].join(" ");

    const writes: string[] = [];
    const result = await submitEventTask(state, {
        defaultHubNotesFolder: "Hub",
        defaultDetailNotesFolder: "Details",
        resolveTargetFile: () => "Daily/2026-08-02.md",
        findMarkdownFile: () => null,
        openFile: () => undefined,
        contextNotes: [
            { path: "People/Andi.md" },
            { path: "Places/Office.md" },
            { path: "Activities/Audit.md", properties: { type: "activity" } },
        ],
        contextSources: [
            {
                id: "people",
                name: "People",
                icon: "users",
                folders: ["People"],
                filter: null,
                relatedHeading: "Interactions",
                enabled: true,
            },
            {
                id: "places",
                name: "Places",
                icon: "map-pin",
                folders: ["Places"],
                filter: null,
                relatedHeading: "Mentions",
                enabled: true,
            },
            {
                id: "activities",
                name: "Activities",
                icon: "activity",
                folders: ["Activities"],
                filter: { property: "type", value: "activity" },
                relatedHeading: "Logs",
                enabled: true,
            },
        ],
        writer: {
            createHubNote: async () => ({ path: "unused.md" }),
            createDetailNote: async () => ({ path: "unused.md" }),
            write: async (_record, path) => writes.push(`primary:${path}`),
            writeRelated: async (_markdown, path) => {
                writes.push(`related:${path}`);
                if (path === "Places/Office.md") throw new Error("place locked");
            },
        },
    });

    assert.deepEqual(writes, [
        "primary:Daily/2026-08-02.md",
        "related:People/Andi.md",
        "related:Places/Office.md",
        "related:Activities/Audit.md",
    ]);
    assert.equal(result.status, "partial");
    if (result.status !== "partial") return;
    assert.deepEqual(result.recovery.completedPaths, ["People/Andi.md", "Activities/Audit.md"]);
    assert.deepEqual(
        result.recovery.failedWrites.map(({ destinationPath, heading, errorMessage }) => ({
            destinationPath,
            heading,
            errorMessage,
        })),
        [{ destinationPath: "Places/Office.md", heading: "Mentions", errorMessage: "place locked" }],
    );
});

test("related submission recovery retries only the receipt failures until success", async () => {
    const attempts: string[] = [];
    const initial = {
        status: "partial" as const,
        kind: "event" as const,
        message: "Event saved with failures",
        createdNotes: { hubPath: null, detailPath: null },
        primaryPath: "Daily/2026-08-02.md",
        recovery: {
            completedPaths: ["People/Andi.md"],
            failedWrites: [
                {
                    destinationPath: "Places/Office.md",
                    heading: "Mentions",
                    position: "end" as const,
                    markdown: "place log",
                    errorMessage: "locked",
                },
                {
                    destinationPath: "Activities/Audit.md",
                    heading: "Logs",
                    position: "end" as const,
                    markdown: "activity log",
                    errorMessage: "offline",
                },
            ],
        },
    };

    const second = await retryRelatedSubmission(initial, {
        writeRelated: async (_markdown, path) => {
            attempts.push(path);
            if (path === "Activities/Audit.md") throw new Error("still offline");
        },
    });
    assert.equal(second.status, "partial");
    if (second.status !== "partial") return;
    assert.deepEqual(second.recovery.completedPaths, ["People/Andi.md", "Places/Office.md"]);
    assert.deepEqual(
        second.recovery.failedWrites.map((write) => write.destinationPath),
        ["Activities/Audit.md"],
    );

    const third = await retryRelatedSubmission(second, {
        writeRelated: async (_markdown, path) => attempts.push(path),
    });
    assert.deepEqual(third, {
        status: "success",
        message: "Related logs saved.",
        createdNotes: { hubPath: null, detailPath: null },
    });
    assert.deepEqual(attempts, ["Places/Office.md", "Activities/Audit.md", "Activities/Audit.md"]);
});

test("writes contextual Inbox and Task logs using their own temporal records", async () => {
    const inboxState = new EventTaskFormState(new Date(2026, 7, 2, 8, 8), {
        file: "Daily.md",
        heading: "Activities & Tasks",
        position: "end",
        hubNotesFolder: "Hub",
        detailNotesFolder: "Details",
    });
    inboxState.inboxTitle = "Ask Andi about archive";
    inboxState.inboxBody = "Follow up with [Andi](../People/Andi.md)";
    const inboxLogs: string[] = [];
    const contextSources = [
        {
            id: "people",
            name: "People",
            icon: "users",
            folders: ["People"],
            filter: null,
            relatedHeading: "Interactions",
            enabled: true,
        },
    ];
    const inboxResult = await submitInbox(inboxState, {
        resolveTarget: () => ({ file: "Daily/2026-08-02.md", heading: "Inbox", position: "end" }),
        contextNotes: [{ path: "People/Andi.md" }],
        contextSources,
        writer: {
            writeInbox: async () => undefined,
            writeRelated: async (markdown) => inboxLogs.push(markdown),
        },
    });

    const taskState = new EventTaskFormState(new Date(2026, 7, 2, 11, 30), {
        file: "Daily.md",
        heading: "Activities & Tasks",
        position: "end",
        hubNotesFolder: "Hub",
        detailNotesFolder: "Details",
    });
    taskState.kind = "task";
    taskState.title = "Send report";
    taskState.description = "Send it to [Andi](../People/Andi.md)";
    taskState.taskDueDate = "2026-08-02";
    taskState.taskDueHasTime = false;
    const taskLogs: string[] = [];
    const taskResult = await submitEventTask(taskState, {
        defaultHubNotesFolder: "Hub",
        defaultDetailNotesFolder: "Details",
        resolveTargetFile: () => "Daily/2026-08-02.md",
        findMarkdownFile: () => null,
        openFile: () => undefined,
        contextNotes: [{ path: "People/Andi.md" }],
        contextSources,
        writer: {
            createHubNote: async () => ({ path: "unused.md" }),
            createDetailNote: async () => ({ path: "unused.md" }),
            write: async () => undefined,
            writeRelated: async (markdown) => taskLogs.push(markdown),
        },
    });

    assert.equal(inboxResult.status, "success");
    assert.deepEqual(inboxLogs, ["- 2026-08-02 08:08 — Ask Andi about archive — [2026-08-02](../Daily/2026-08-02.md)"]);
    assert.equal(taskResult.status, "success");
    assert.deepEqual(taskLogs, ["- 2026-08-02 — Send report — [2026-08-02](../Daily/2026-08-02.md)"]);
});
