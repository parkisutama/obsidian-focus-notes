import type { App } from "obsidian";
import type { LedgerRecordSnapshot, LedgerRecordSource } from "../../../features/capture/scheduled-item/domain/LedgerRecordSource.ts";
import { captureLedgerRecord } from "../../../features/capture/scheduled-item/domain/LedgerRecordSource.ts";
import type { MomentBlock, MomentBlockInvalidReason } from "../../../features/capture/moment/domain/MomentBlock.ts";
import { parseMomentBlock } from "../../../features/capture/moment/domain/MomentBlock.ts";
import { isTFile } from "../vault/ObsidianFileTypes.ts";

export type CaptureMomentEditResult =
    | { status: "captured"; snapshot: LedgerRecordSnapshot; block: MomentBlock }
    | { status: "conflict"; reason: "file-missing" | "line-missing" | "line-changed" }
    | { status: "invalid"; reason: MomentBlockInvalidReason };

/** Resolves the exact Moment block at a known source line, ready to hand to `saveMomentBlock`. */
export async function captureMomentEdit(app: App, source: LedgerRecordSource): Promise<CaptureMomentEditResult> {
    const file = app.vault.getAbstractFileByPath(source.filePath);
    if (!isTFile(file)) return { status: "conflict", reason: "file-missing" };
    const captured = captureLedgerRecord(await app.vault.read(file), source);
    if (captured.status === "conflict") return captured;
    const parsed = parseMomentBlock(captured.snapshot.rawBlock);
    if (parsed.status === "invalid") return parsed;
    return { status: "captured", snapshot: captured.snapshot, block: parsed.block };
}
