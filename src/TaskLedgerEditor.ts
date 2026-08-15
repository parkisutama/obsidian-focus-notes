import type { App } from "obsidian";
import {
    captureLedgerRecord,
    type LedgerRecordConflictReason,
    type LedgerRecordSnapshot,
    type LedgerRecordSource,
    replaceLedgerRecord,
} from "./LedgerRecordSource.ts";
import { editTaskLine, type TaskLineEdit } from "./TaskLineEditor.ts";
import { isTFile } from "./utils.ts";

type FileConflictReason = LedgerRecordConflictReason | "file-missing";

export type CaptureTaskLedgerEditResult =
    | { status: "captured"; snapshot: LedgerRecordSnapshot }
    | { status: "conflict"; reason: "file-missing" | "line-missing" | "line-changed" };

export type SaveTaskLedgerEditResult =
    | { status: "saved" }
    | { status: "unchanged" }
    | { status: "conflict"; reason: FileConflictReason }
    | { status: "invalid"; reason: "not-task" };

export async function captureTaskLedgerEdit(
    app: App,
    source: LedgerRecordSource,
): Promise<CaptureTaskLedgerEditResult> {
    const file = app.vault.getAbstractFileByPath(source.filePath);
    if (!isTFile(file)) return { status: "conflict", reason: "file-missing" };
    return captureLedgerRecord(await app.vault.read(file), source);
}

export async function saveTaskLedgerEdit(
    app: App,
    snapshot: LedgerRecordSnapshot,
    edit: TaskLineEdit,
): Promise<SaveTaskLedgerEditResult> {
    const editedLine = editTaskLine(snapshot.rawLine, edit);
    if (editedLine.status === "invalid") return editedLine;

    const file = app.vault.getAbstractFileByPath(snapshot.filePath);
    if (!isTFile(file)) return { status: "conflict", reason: "file-missing" };

    let outcome: SaveTaskLedgerEditResult = { status: "unchanged" };
    await app.vault.process(file, (currentContent) => {
        const replaced = replaceLedgerRecord(currentContent, snapshot, editedLine.line);
        if (replaced.status === "conflict") {
            outcome = replaced;
            return currentContent;
        }
        if (replaced.content === currentContent) return currentContent;
        outcome = { status: "saved" };
        return replaced.content;
    });
    return outcome;
}
