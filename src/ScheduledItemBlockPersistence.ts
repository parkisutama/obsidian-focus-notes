import type { App } from "obsidian";
import type { LedgerRecordSnapshot } from "./LedgerRecordSource.ts";
import { replaceScheduledItemBlock, type ScheduledItemBlockEdit } from "./ScheduledItemBlockEditor.ts";
import { isTFile } from "./utils.ts";

export type SaveScheduledItemBlockResult =
    | { status: "saved" | "unchanged" }
    | { status: "conflict"; reason: "file-missing" | "line-missing" | "line-changed" | "block-changed" | "ambiguous" }
    | { status: "invalid"; reason: "empty-block" | "duplicate-detail" };

export async function saveScheduledItemBlock(
    app: App,
    snapshot: LedgerRecordSnapshot,
    edit: ScheduledItemBlockEdit,
): Promise<SaveScheduledItemBlockResult> {
    const file = app.vault.getAbstractFileByPath(snapshot.filePath);
    if (!isTFile(file)) return { status: "conflict", reason: "file-missing" };
    let outcome: SaveScheduledItemBlockResult = { status: "unchanged" };
    await app.vault.process(file, (content) => {
        const replaced = replaceScheduledItemBlock(content, snapshot, edit);
        if (replaced.status !== "ready") {
            outcome = replaced.status === "conflict" ? replaced : { status: "invalid", reason: replaced.reason };
            return content;
        }
        if (replaced.content === content) return content;
        outcome = { status: "saved" };
        return replaced.content;
    });
    return outcome;
}
