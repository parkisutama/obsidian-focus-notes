import type { App } from "obsidian";
import {
    classifyScheduledItemBlockId,
    extractScheduledItemBlockId,
} from "../../../features/capture/scheduled-item/domain/ScheduledItemBlockId.ts";
import { isTFile } from "../vault/ObsidianFileTypes.ts";

export type ResolveCanonicalScheduledItemResult =
    | { status: "resolved"; filePath: string; lineNumber: number; rawLine: string }
    | { status: "invalid-target" }
    | { status: "orphan" }
    | { status: "ambiguous" };

/**
 * Locates the canonical line a `file#^blockId` reference target points at. Never guesses: a
 * missing file or block id is reported as an orphan, and more than one matching line (a
 * duplicated block id) is reported as ambiguous, so callers never fall back to creating or
 * editing the wrong block.
 */
export async function resolveCanonicalScheduledItemSource(
    app: App,
    canonicalTarget: string,
): Promise<ResolveCanonicalScheduledItemResult> {
    const match = canonicalTarget.match(/^(.+)#\^(.+)$/);
    if (!match) return { status: "invalid-target" };
    const [, filePath, blockId] = match;

    const file = app.vault.getAbstractFileByPath(filePath);
    if (!isTFile(file)) return { status: "orphan" };

    const content = await app.vault.cachedRead(file);
    const lines = content.split(/\r?\n/);
    const matches: Array<{ lineNumber: number; rawLine: string }> = [];
    lines.forEach((line, index) => {
        if (extractScheduledItemBlockId(line).blockId === blockId) {
            matches.push({ lineNumber: index + 1, rawLine: line });
        }
    });

    if (matches.length === 0) return { status: "orphan" };
    if (matches.length > 1) return { status: "ambiguous" };
    return { status: "resolved", filePath, lineNumber: matches[0].lineNumber, rawLine: matches[0].rawLine };
}

/** Moment-specific entry point: prevents a Task/Event target from being opened by the Moment editor. */
export async function resolveCanonicalMomentSource(
    app: App,
    canonicalTarget: string,
): Promise<ResolveCanonicalScheduledItemResult> {
    const match = canonicalTarget.match(/^(.+)#\^(.+)$/);
    if (!match || classifyScheduledItemBlockId(match[2]) !== "moment") return { status: "invalid-target" };
    return resolveCanonicalScheduledItemSource(app, canonicalTarget);
}
