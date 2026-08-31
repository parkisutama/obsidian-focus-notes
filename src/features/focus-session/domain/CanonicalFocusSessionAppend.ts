import { insertScheduledItemChildLine } from "../../capture/scheduled-item/domain/ScheduledItemChildInsertion.ts";
import type { EmotionCategory, StressLevel } from "../../reflection/domain/Wellbeing.ts";
import { formatFocusSessionLine, parseFocusSessionLine } from "./FocusSessionLine.ts";
import type { FocusSessionOwner } from "./OwnedFocusSession.ts";
import type { DisplayMode } from "./Timer.ts";

export interface CanonicalFocusSessionFields {
    actualStart: string;
    actualEnd: string;
    durationSeconds: number;
    mode: DisplayMode;
    /**
     * Whatever the user already filled in on LogModal at stop-time, if anything — carried
     * straight into the canonical line so Edit Session later shows what was actually logged
     * instead of starting blank. All optional; a session logged with none of these set can still
     * have them added afterward via editFocusSessionInBlock.
     */
    stressLevel?: StressLevel | null;
    emotionCategory?: EmotionCategory | null;
    emotionKey?: string | null;
    notes?: string | null;
}

export type RecordFocusSessionResult =
    | { status: "recorded"; block: string }
    | { status: "already-recorded"; block: string }
    | { status: "anchor-not-found" };

/**
 * Appends one `focus-session` child line (plus an optional `- notes: ...` child of its own) to
 * `rawBlock` under the owner's anchor: a Task's timebox line, or an Event's own first line.
 * Idempotent by `sessionId` so a caller retrying a partially-failed write (e.g. the canonical
 * save succeeded but a later step didn't) can safely call this again with the same id instead of
 * risking a duplicate history entry.
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
    const result = insertScheduledItemChildLine(rawBlock, anchorBlockId, (indent, lineEnding) => {
        const mainLine = formatFocusSessionLine(
            {
                start: fields.actualStart,
                end: fields.actualEnd,
                durationSeconds: fields.durationSeconds,
                mode: fields.mode,
                sessionId,
                stressLevel: fields.stressLevel,
                emotionCategory: fields.emotionCategory,
                emotionKey: fields.emotionKey,
            },
            indent,
        );
        const trimmedNotes = fields.notes?.trim();
        return trimmedNotes ? `${mainLine}${lineEnding}${indent}  - notes: ${trimmedNotes}` : mainLine;
    });
    if (result.status === "anchor-not-found") return result;
    return { status: "recorded", block: result.content };
}

export interface EditFocusSessionFields {
    stressLevel: StressLevel | null;
    emotionCategory: EmotionCategory | null;
    emotionKey: string | null;
    /** Trimmed and stored as an indented `- notes: ...` child line; null/empty removes it. */
    notes: string | null;
}

export type EditFocusSessionResult = { status: "edited"; block: string } | { status: "not-found" };

const NOTES_CHILD_RE = /^\s*-\s*notes:/;

/**
 * Rewrites an existing `focus-session` line's reflection fields (stress/emotion/mood/notes) in
 * place, preserving its start/end/duration/mode/sessionId exactly as parsed — those are tied to
 * when the timer actually ran and are never editable through this path. Unlike
 * `recordFocusSessionInBlock` (append), this replaces the line and its own `- notes: ...` child
 * (if any), so it's safe to call repeatedly as the user refines their reflection later.
 */
export function editFocusSessionInBlock(
    rawBlock: string,
    sessionId: string,
    fields: EditFocusSessionFields,
): EditFocusSessionResult {
    const lineEnding = rawBlock.includes("\r\n") ? "\r\n" : "\n";
    const lines = rawBlock.split(/\r\n|\n/);
    const trailing = new RegExp(`\\^${sessionId}\\s*$`);
    const lineIndex = lines.findIndex((line) => trailing.test(line));
    if (lineIndex === -1) return { status: "not-found" };

    const parsed = parseFocusSessionLine(lines[lineIndex]);
    if (parsed.status !== "parsed") return { status: "not-found" };

    const indent = lines[lineIndex].match(/^[\t ]*/)?.[0] ?? "";
    const newLine = formatFocusSessionLine(
        {
            start: parsed.session.start,
            end: parsed.session.end,
            durationSeconds: parsed.session.durationSeconds,
            mode: parsed.session.mode,
            sessionId,
            stressLevel: fields.stressLevel,
            emotionCategory: fields.emotionCategory,
            emotionKey: fields.emotionKey,
        },
        indent,
    );

    const nextLine = lines[lineIndex + 1];
    const hasExistingNotes =
        nextLine !== undefined &&
        (nextLine.match(/^[\t ]*/)?.[0].length ?? 0) > indent.length &&
        NOTES_CHILD_RE.test(nextLine);
    const removeCount = hasExistingNotes ? 2 : 1;

    const trimmedNotes = fields.notes?.trim();
    const replacement = trimmedNotes ? [newLine, `${indent}  - notes: ${trimmedNotes}`] : [newLine];
    lines.splice(lineIndex, removeCount, ...replacement);

    return { status: "edited", block: lines.join(lineEnding) };
}
