import { parseTaskTimeboxLine } from "../../capture/scheduled-item/domain/TaskTimeboxLine.ts";
import type { EmotionCategory, StressLevel } from "../../reflection/domain/Wellbeing.ts";
import { parseFocusSessionLine } from "./FocusSessionLine.ts";
import type { DisplayMode } from "./Timer.ts";

const NOTES_CHILD_RE = /^\s*-\s*notes:\s?(.*)$/;

export interface ScannedFocusSession {
    sessionId: string;
    start: string;
    end: string;
    durationSeconds: number;
    mode: DisplayMode;
    /** The Task timebox this session is nested under, or null when it's a direct Event child. */
    ownerTimeboxId: string | null;
    stressLevel: StressLevel | null;
    emotionCategory: EmotionCategory | null;
    emotionKey: string | null;
    /** Free-text reflection from an indented `- notes: ...` child line, or null when absent. */
    notes: string | null;
}

/**
 * Walks a canonical block's raw text by indentation, the same tree-shape `ScheduledItemBlockEditor`
 * uses for timeboxes, to collect every `focus-session` child and the id of the nearest ancestor
 * `timebox` line above it (or `null` when it sits directly under the block's own first line, i.e.
 * an Event). Kept separate from `ScheduledItemBlockEditor` so reading Focus Session history never
 * risks perturbing the Task/Event edit path that module serves.
 */
export function scanFocusSessionsInBlock(rawBlock: string): ScannedFocusSession[] {
    const lines = rawBlock.split(/\r?\n/);
    const sessions: ScannedFocusSession[] = [];
    const stack: Array<{ indent: number; timeboxId: string | null }> = [{ indent: -1, timeboxId: null }];
    // The `- notes: ...` line is a Focus Session's optional child, one indent level deeper — only
    // the line immediately following a focus-session line can claim it, mirroring how the tree
    // walk otherwise scopes children strictly by position rather than a stored id reference.
    let pendingNotes: { session: ScannedFocusSession; indent: number } | null = null;

    for (let index = 1; index < lines.length; index += 1) {
        const line = lines[index];
        if (!line.trim()) continue;
        const indent = line.match(/^[\t ]*/)?.[0].length ?? 0;

        if (pendingNotes) {
            const notesMatch = indent > pendingNotes.indent ? line.match(NOTES_CHILD_RE) : null;
            if (notesMatch) {
                pendingNotes.session.notes = notesMatch[1].trim() || null;
                pendingNotes = null;
                continue;
            }
            pendingNotes = null;
        }

        while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
        const parent = stack[stack.length - 1];

        const timebox = parseTaskTimeboxLine(line);
        if (timebox.status === "parsed") {
            stack.push({ indent, timeboxId: timebox.timebox.timeboxId });
            continue;
        }

        const focusSession = parseFocusSessionLine(line);
        if (focusSession.status === "parsed") {
            const scanned: ScannedFocusSession = {
                ...focusSession.session,
                ownerTimeboxId: parent.timeboxId,
                notes: null,
            };
            sessions.push(scanned);
            pendingNotes = { session: scanned, indent };
        }
        stack.push({ indent, timeboxId: parent.timeboxId });
    }

    return sessions;
}
