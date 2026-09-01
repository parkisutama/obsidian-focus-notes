import type { App } from "obsidian";
import {
    applyScheduledItemBlockFormatChanges,
    type ScheduledItemBlockFormatChange,
} from "../../../features/capture/scheduled-item/domain/ScheduledItemBlockFormat.ts";
import { isTFile } from "../vault/ObsidianFileTypes.ts";

export type SaveScheduledItemBlockFormatChangesResult =
    | { status: "saved" | "unchanged" }
    | { status: "file-missing" }
    | { status: "conflict" | "ambiguous"; lineNumber: number };

export async function saveScheduledItemBlockFormatChanges(
    app: App,
    filePath: string,
    changes: readonly ScheduledItemBlockFormatChange[],
): Promise<SaveScheduledItemBlockFormatChangesResult> {
    const file = app.vault.getAbstractFileByPath(filePath);
    if (!isTFile(file)) return { status: "file-missing" };

    let outcome: SaveScheduledItemBlockFormatChangesResult = { status: "unchanged" };
    await app.vault.process(file, (content) => {
        const applied = applyScheduledItemBlockFormatChanges(content, filePath, changes);
        if (applied.status !== "ready") {
            outcome = applied;
            return content;
        }
        if (applied.content === content) return content;
        outcome = { status: "saved" };
        return applied.content;
    });
    return outcome;
}
