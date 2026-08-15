import type { App } from "obsidian";
import { isTFile } from "./utils.ts";

export interface TaskFormatChange {
    lineNumber: number;
    rawLine: string;
    normalizedLine: string;
}

export type ApplyTaskFormatChangesResult =
    | { status: "ready"; content: string }
    | { status: "conflict" | "ambiguous"; lineNumber: number };

export type SaveTaskFormatChangesResult =
    | { status: "saved" | "unchanged" }
    | { status: "file-missing" }
    | { status: "conflict" | "ambiguous"; lineNumber: number };

interface SourceLine {
    content: string;
    startOffset: number;
    contentEndOffset: number;
}

export function applyTaskFormatChanges(
    content: string,
    changes: readonly TaskFormatChange[],
): ApplyTaskFormatChangesResult {
    const lines = splitSourceLines(content);
    const seen = new Set<number>();
    for (const change of changes) {
        if (seen.has(change.lineNumber)) return { status: "ambiguous", lineNumber: change.lineNumber };
        seen.add(change.lineNumber);
        if (lines[change.lineNumber - 1]?.content !== change.rawLine) {
            return { status: "conflict", lineNumber: change.lineNumber };
        }
    }

    let formatted = content;
    for (const change of [...changes].sort((a, b) => b.lineNumber - a.lineNumber)) {
        const line = lines[change.lineNumber - 1];
        formatted =
            formatted.slice(0, line.startOffset) + change.normalizedLine + formatted.slice(line.contentEndOffset);
    }
    return { status: "ready", content: formatted };
}

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

function splitSourceLines(content: string): SourceLine[] {
    const lines: SourceLine[] = [];
    let startOffset = 0;
    for (let index = 0; index <= content.length; index += 1) {
        if (index !== content.length && content[index] !== "\n") continue;
        const contentEndOffset = index > startOffset && content[index - 1] === "\r" ? index - 1 : index;
        lines.push({ content: content.slice(startOffset, contentEndOffset), startOffset, contentEndOffset });
        startOffset = index + 1;
    }
    return lines;
}
