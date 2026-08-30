import { parseTaskTimeboxLine } from "../../capture/scheduled-item/domain/TaskTimeboxLine.ts";
import { parseFocusSessionLine } from "./FocusSessionLine.ts";
import type { DisplayMode } from "./Timer.ts";

export interface ScannedFocusSession {
    sessionId: string;
    start: string;
    end: string;
    durationSeconds: number;
    mode: DisplayMode;
    /** The Task timebox this session is nested under, or null when it's a direct Event child. */
    ownerTimeboxId: string | null;
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

    for (let index = 1; index < lines.length; index += 1) {
        const line = lines[index];
        if (!line.trim()) continue;
        const indent = line.match(/^[\t ]*/)?.[0].length ?? 0;
        while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
        const parent = stack[stack.length - 1];

        const timebox = parseTaskTimeboxLine(line);
        if (timebox.status === "parsed") {
            stack.push({ indent, timeboxId: timebox.timebox.timeboxId });
            continue;
        }

        const focusSession = parseFocusSessionLine(line);
        if (focusSession.status === "parsed") {
            sessions.push({ ...focusSession.session, ownerTimeboxId: parent.timeboxId });
        }
        stack.push({ indent, timeboxId: parent.timeboxId });
    }

    return sessions;
}
