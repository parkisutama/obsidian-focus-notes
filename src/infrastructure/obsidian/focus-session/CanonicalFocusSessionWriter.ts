import type { App } from "obsidian";
import {
    captureLedgerRecord,
    replaceLedgerRecordBlock,
} from "../../../features/capture/scheduled-item/domain/LedgerRecordSource.ts";
import {
    type CanonicalFocusSessionFields,
    recordFocusSessionInBlock,
} from "../../../features/focus-session/domain/CanonicalFocusSessionAppend.ts";
import type { FocusSessionOwner } from "../../../features/focus-session/domain/OwnedFocusSession.ts";
import { getScheduledItemMentionSource } from "../suggestions/ObsidianScheduledItemMentionSource.ts";
import { isTFile } from "../vault/ObsidianFileTypes.ts";

export type WriteCanonicalFocusSessionResult =
    | { status: "written"; filePath: string }
    | { status: "already-recorded"; filePath: string }
    | { status: "orphan" };

/**
 * Appends one actual Focus Session as a canonical child of its owning Event or Task timebox line,
 * resolving the owner's `itemId` to a live file/line via the shared mention index (Task 42 already
 * keeps it warm for the purpose selector). Idempotent by `sessionId`, so a caller retrying a
 * previously-failed attempt with the same id never duplicates history.
 */
export async function writeCanonicalFocusSession(
    app: App,
    owner: FocusSessionOwner,
    sessionId: string,
    fields: CanonicalFocusSessionFields,
): Promise<WriteCanonicalFocusSessionResult> {
    const source = getScheduledItemMentionSource(app);
    await source.sync();
    const candidate = source.findCandidate(owner.kind, owner.itemId);
    if (!candidate) return { status: "orphan" };

    const file = app.vault.getAbstractFileByPath(candidate.filePath);
    if (!isTFile(file)) return { status: "orphan" };

    const content = await app.vault.read(file);
    const rawLine = content.split(/\r?\n/)[candidate.lineNumber - 1];
    if (!rawLine) return { status: "orphan" };

    const captured = captureLedgerRecord(content, {
        filePath: candidate.filePath,
        lineNumber: candidate.lineNumber,
        rawLine,
    });
    if (captured.status !== "captured") return { status: "orphan" };

    const recorded = recordFocusSessionInBlock(captured.snapshot.rawBlock, owner, fields, sessionId);
    if (recorded.status === "anchor-not-found") return { status: "orphan" };
    if (recorded.status === "already-recorded") return { status: "already-recorded", filePath: candidate.filePath };

    const replaced = replaceLedgerRecordBlock(content, captured.snapshot, recorded.block);
    if (replaced.status !== "ready") return { status: "orphan" };

    await app.vault.modify(file, replaced.content);
    return { status: "written", filePath: candidate.filePath };
}
