import assert from "node:assert/strict";
import test from "node:test";
import { EventTaskFormState } from "../src/EventTaskFormState.ts";
import { submitEventTask } from "../src/EventTaskSubmission.ts";

test("writes the primary record and created notes through a renderer-independent submission", async () => {
    const state = new EventTaskFormState(new Date(2026, 7, 1, 9, 0), {
        file: "Daily.md",
        heading: "Schedule",
        position: "end",
        hubNotesFolder: "Hub",
        detailNotesFolder: "Details"
    });
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
        openFile: file => opened.push(file.path),
        writer: {
            createHubNote: async () => ({ path: "Hub/Planning hub.md" }),
            createDetailNote: async () => ({ path: "Details/Planning detail.md" }),
            write: async (_record, path, _heading, _position, detail) => {
                writes.push({ path, hasDetail: Boolean(detail) });
            }
        }
    });

    assert.deepEqual(result, { ok: true, message: "Event saved." });
    assert.deepEqual(opened, ["Hub/Planning hub.md", "Details/Planning detail.md"]);
    assert.deepEqual(writes, [
        { path: "Daily/2026-08-01.md", hasDetail: true },
        { path: "Hub/Planning hub.md", hasDetail: true }
    ]);
});
test("returns a phase-specific failure without reporting success", async () => {
    const state = new EventTaskFormState(new Date(2026, 7, 1, 9, 0), {
        file: "Daily.md",
        heading: "Schedule",
        position: "end",
        hubNotesFolder: "Hub",
        detailNotesFolder: "Details"
    });
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
            createDetailNote: async () => { throw new Error("vault is read-only"); },
            write: async () => undefined
        }
    });

    assert.deepEqual(result, { ok: false, message: "Failed to create detail note: vault is read-only" });
});
