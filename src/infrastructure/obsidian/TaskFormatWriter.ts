import type { App } from "obsidian";
import {
    applyTaskFormatChanges,
    type TaskFormatChange,
} from "../../features/capture/scheduled-item/domain/TaskFormatWriter.ts";
import { isTFile } from "./ObsidianFileTypes.ts";

export type SaveTaskFormatChangesResult =
    | { status: "saved" | "unchanged" }
    | { status: "file-missing" }
    | { status: "conflict" | "ambiguous"; lineNumber: number };

export async function saveTaskFormatChanges(
    app: App,
    filePath: string,
    changes: readonly TaskFormatChange[],
): Promise<SaveTaskFormatChangesResult> {
    const file = app.vault.getAbstractFileByPath(filePath);
    if (!isTFile(file)) return { status: "file-missing" };

    let outcome: SaveTaskFormatChangesResult = { status: "unchanged" };
    await app.vault.process(file, (content) => {
        const applied = applyTaskFormatChanges(content, changes);
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
