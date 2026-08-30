import { insertScheduledItemChildLine } from "../../capture/scheduled-item/domain/ScheduledItemChildInsertion.ts";
import type { FocusSessionOwner } from "./OwnedFocusSession.ts";
import { formatFocusSessionLine } from "./FocusSessionLine.ts";
import type { DisplayMode } from "./Timer.ts";

export interface CanonicalFocusSessionFields {
    actualStart: string;
    actualEnd: string;
    durationSeconds: number;
    mode: DisplayMode;
}

export type RecordFocusSessionResult =
    | { status: "recorded"; block: string }
    | { status: "already-recorded"; block: string }
    | { status: "anchor-not-found" };

/**
 * Appends one `focus-session` child line to `rawBlock` under the owner's anchor: a Task's
 * timebox line, or an Event's own first line. Idempotent by `sessionId` so a caller retrying a
 * partially-failed write (e.g. the canonical save succeeded but a later step didn't) can safely
 * call this again with the same id instead of risking a duplicate history entry.
 */
export function recordFocusSessionInBlock(
    rawBlock: string,
    owner: FocusSessionOwner,
    fields: CanonicalFocusSessionFields,
    sessionId: string,
): RecordFocusSessionResult {
    if (new RegExp(`\\^${sessionId}\\s*$`, "m").test(rawBlock)) {
        return { status: "already-recorded", block: rawBlock };
    }

    const anchorBlockId = owner.kind === "event" ? owner.itemId : owner.timeboxId;
    const result = insertScheduledItemChildLine(rawBlock, anchorBlockId, (indent) =>
        formatFocusSessionLine(
            {
                start: fields.actualStart,
                end: fields.actualEnd,
                durationSeconds: fields.durationSeconds,
                mode: fields.mode,
                sessionId,
            },
            indent,
        ),
    );
    if (result.status === "anchor-not-found") return result;
    return { status: "recorded", block: result.content };
}
