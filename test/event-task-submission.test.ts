import assert from "node:assert/strict";
import test from "node:test";
import { resolveRelativeLinkDestination } from "../src/features/capture/application/ContextLinkResolver.ts";
import { EventTaskFormState } from "../src/features/capture/domain/EventTaskFormState.ts";
import { retryRelatedSubmission, submitInbox } from "../src/features/capture/moment/application/EventTaskSubmission.ts";

test("writes Inbox once through a renderer-independent submission", async () => {
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
        resolveLinkDestination: resolveRelativeLinkDestination,
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
        resolveLinkDestination: resolveRelativeLinkDestination,
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
        resolveLinkDestination: resolveRelativeLinkDestination,
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

test("backlinks a weekly-note Moment capture into the same-day Daily Note", async () => {
    const state = new EventTaskFormState(new Date(2026, 7, 2, 9, 12), {
        file: "Planning.md",
        heading: "Schedule",
        position: "end",
        hubNotesFolder: "Hub",
        detailNotesFolder: "Details",
    });
    state.inboxBody = "Discuss with Andi";
    const primaryWrites: unknown[] = [];
    const relatedWrites: unknown[] = [];

    const result = await submitInbox(state, {
        resolveTarget: () => ({ file: "Weekly/2026-W31.md", heading: "2026-08-02", position: "end" }),
        resolveDailyBacklinkTarget: () => ({ file: "Daily/2026-08-02.md", heading: "Moments", position: "end" }),
        resolveLinkDestination: resolveRelativeLinkDestination,
        writer: {
            writeInbox: async (record, file, heading, position) => {
                primaryWrites.push({ record, file, heading, position });
            },
            writeRelated: async (markdown, file, heading, position) => {
                relatedWrites.push({ markdown, file, heading, position });
            },
        },
    });

    assert.equal(result.status, "success");
    assert.equal(primaryWrites.length, 1);
    assert.equal(relatedWrites.length, 1);
    const backlink = relatedWrites[0] as { markdown: string; file: string; heading: string; position: string };
    assert.equal(backlink.file, "Daily/2026-08-02.md");
    assert.equal(backlink.heading, "Moments");
    assert.equal(backlink.position, "end");
    assert.match(backlink.markdown, /\[2026-W31\]\(\.\.\/Weekly\/2026-W31\.md\)/);
});

test("passes a time-only write option for weekly-note Moment captures", async () => {
    const state = new EventTaskFormState(new Date(2026, 7, 2, 9, 12), {
        file: "Planning.md",
        heading: "Schedule",
        position: "end",
        hubNotesFolder: "Hub",
        detailNotesFolder: "Details",
    });
    state.inboxBody = "Discuss with Andi";
    const writeOptions: unknown[] = [];

    await submitInbox(state, {
        resolveTarget: () => ({ file: "Weekly/2026-W31.md", heading: "2026-08-02", position: "end" }),
        usesDatedHeading: true,
        resolveLinkDestination: resolveRelativeLinkDestination,
        writer: {
            writeInbox: async (_record, _file, _heading, _position, options) => {
                writeOptions.push(options);
            },
            writeRelated: async () => undefined,
        },
    });

    assert.deepEqual(writeOptions, [{ timeOnly: true }]);
});

test("omits the Daily Note backlink when it is unavailable", async () => {
    const state = new EventTaskFormState(new Date(2026, 7, 2, 9, 12), {
        file: "Planning.md",
        heading: "Schedule",
        position: "end",
        hubNotesFolder: "Hub",
        detailNotesFolder: "Details",
    });
    state.inboxBody = "Discuss with Andi";
    const relatedWrites: unknown[] = [];

    const result = await submitInbox(state, {
        resolveTarget: () => ({ file: "Weekly/2026-W31.md", heading: "2026-08-02", position: "end" }),
        resolveDailyBacklinkTarget: () => null,
        resolveLinkDestination: resolveRelativeLinkDestination,
        writer: {
            writeInbox: async () => undefined,
            writeRelated: async (markdown, file, heading, position) => {
                relatedWrites.push({ markdown, file, heading, position });
            },
        },
    });

    assert.equal(result.status, "success");
    assert.equal(relatedWrites.length, 0);
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

test("writes contextual Inbox logs using its own temporal record", async () => {
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
            matchByFolder: true,
            matchByProperty: true,
            relatedHeading: "Interactions",
            enabled: true,
        },
    ];
    const inboxResult = await submitInbox(inboxState, {
        resolveTarget: () => ({ file: "Daily/2026-08-02.md", heading: "Inbox", position: "end" }),
        resolveLinkDestination: resolveRelativeLinkDestination,
        contextNotes: [{ path: "People/Andi.md" }],
        contextSources,
        writer: {
            writeInbox: async () => undefined,
            writeRelated: async (markdown) => inboxLogs.push(markdown),
        },
    });

    assert.equal(inboxResult.status, "success");
    assert.deepEqual(inboxLogs, ["- 2026-08-02 08:08 — Ask Andi about archive — [2026-08-02](../Daily/2026-08-02.md)"]);
});
