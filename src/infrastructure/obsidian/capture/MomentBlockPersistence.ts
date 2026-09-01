import type { App } from "obsidian";
import type { MomentBlockEdit } from "../../../features/capture/moment/domain/MomentBlockEditor.ts";
import { replaceMomentBlock } from "../../../features/capture/moment/domain/MomentBlockEditor.ts";
import type { LedgerRecordSnapshot } from "../../../features/capture/scheduled-item/domain/LedgerRecordSource.ts";
import { isTFile } from "../vault/ObsidianFileTypes.ts";

export type SaveMomentBlockResult =
    | { status: "saved" | "unchanged" }
    | { status: "conflict"; reason: "file-missing" | "line-missing" | "line-changed" | "block-changed" | "ambiguous" }
    | {
          status: "invalid";
          reason: "missing-id" | "duplicate-description" | "duplicate-reflection" | "duplicate-reflection-notes";
      };

export async function saveMomentBlock(
    app: App,
    snapshot: LedgerRecordSnapshot,
    edit: MomentBlockEdit,
): Promise<SaveMomentBlockResult> {
    const file = app.vault.getAbstractFileByPath(snapshot.filePath);
    if (!isTFile(file)) return { status: "conflict", reason: "file-missing" };
    let outcome: SaveMomentBlockResult = { status: "unchanged" };
    await app.vault.process(file, (content) => {
        const replaced = replaceMomentBlock(content, snapshot, edit);
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
