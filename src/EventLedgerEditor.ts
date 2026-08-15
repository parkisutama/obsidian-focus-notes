import type { App } from "obsidian";
import {
    editEventLine,
    type EventLineEdit,
    type EventLineInvalidReason,
    parseEventLineEdit,
    type ParseEventLineEditResult,
} from "./EventLineEditor.ts";
import {
    captureLedgerRecord,
    type LedgerRecordConflictReason,
    type LedgerRecordSnapshot,
    type LedgerRecordSource,
    replaceLedgerRecord,
} from "./LedgerRecordSource.ts";
import { isTFile } from "./utils.ts";

type FileConflictReason = LedgerRecordConflictReason | "file-missing";

export type CaptureEventLedgerEditResult =
    | { status: "captured"; snapshot: LedgerRecordSnapshot; edit: EventLineEdit }
    | { status: "conflict"; reason: "file-missing" | "line-missing" | "line-changed" }
    | Exclude<ParseEventLineEditResult, { status: "parsed" }>;

export type SaveEventLedgerEditResult =
    | { status: "saved" }
    | { status: "unchanged" }
    | { status: "conflict"; reason: FileConflictReason }
    | { status: "invalid"; reason: EventLineInvalidReason };

export async function captureEventLedgerEdit(
    app: App,
    source: LedgerRecordSource,
): Promise<CaptureEventLedgerEditResult> {
    const file = app.vault.getAbstractFileByPath(source.filePath);
    if (!isTFile(file)) return { status: "conflict", reason: "file-missing" };
    const captured = captureLedgerRecord(await app.vault.read(file), source);
    if (captured.status === "conflict") return captured;
    const parsed = parseEventLineEdit(captured.snapshot.rawLine);
    if (parsed.status === "invalid") return parsed;
    return { status: "captured", snapshot: captured.snapshot, edit: parsed.edit };
}

export async function saveEventLedgerEdit(
    app: App,
    snapshot: LedgerRecordSnapshot,
    edit: EventLineEdit,
): Promise<SaveEventLedgerEditResult> {
    const editedLine = editEventLine(snapshot.rawLine, edit);
    if (editedLine.status === "invalid") return editedLine;
    const validated = parseEventLineEdit(editedLine.line);
    if (validated.status === "invalid") return validated;

    const file = app.vault.getAbstractFileByPath(snapshot.filePath);
    if (!isTFile(file)) return { status: "conflict", reason: "file-missing" };
    let outcome: SaveEventLedgerEditResult = { status: "unchanged" };
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
