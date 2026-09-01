import { parseReflectionNotesLine } from "../../capture/shared/domain/FlatBlockChildLine.ts";
import { parseReflectionLabel } from "../../reflection/domain/ReflectionBlockLine.ts";
import type { EmotionCategory, StressLevel } from "../../reflection/domain/Wellbeing.ts";
import { parseFocusSessionLine } from "./FocusSessionLine.ts";
import type { DisplayMode } from "./Timer.ts";

export interface ScannedFocusSession {
    sessionId: string;
    start: string;
    end: string;
    durationSeconds: number;
    mode: DisplayMode;
    stressLevel: StressLevel | null;
    emotionCategory: EmotionCategory | null;
    emotionKey: string | null;
    notes: string | null;
}

/** Scans only direct owner sessions; Timebox descendants are deliberately not owners. */
export function scanFocusSessionsInBlock(rawBlock: string): ScannedFocusSession[] {
    const lines = rawBlock.split(/\r?\n/);
    const directIndent = findDirectIndent(lines.slice(1));
    if (directIndent === null) return [];
    const sessions: ScannedFocusSession[] = [];

    for (let index = 1; index < lines.length; index += 1) {
        const line = lines[index];
        if (leadingIndent(line) !== directIndent) continue;
        const parsed = parseFocusSessionLine(line);
        if (parsed.status !== "parsed") continue;
        const session: ScannedFocusSession = {
            ...parsed.session,
            stressLevel: null,
            emotionCategory: null,
            emotionKey: null,
            notes: null,
        };
        for (let childIndex = index + 1; childIndex < lines.length; childIndex += 1) {
            const child = lines[childIndex];
            const indent = leadingIndent(child);
            if (!child.trim()) continue;
            if (indent <= directIndent) break;
            const payload = child.trimStart().match(/^- (.*)$/)?.[1];
            if (!payload) continue;
            const reflection = parseReflectionLabel(payload);
            if (reflection) Object.assign(session, reflection);
            const notes = parseReflectionNotesLine(payload);
            if (notes !== null) session.notes = notes || null;
        }
        sessions.push(session);
    }
    return sessions;
}

function findDirectIndent(lines: string[]): number | null {
    const values = lines
        .filter((line) => line.trim())
        .map(leadingIndent)
        .filter((value) => value > 0);
    return values.length ? Math.min(...values) : null;
}

function leadingIndent(line: string): number {
    return line.match(/^[\t ]*/)?.[0].length ?? 0;
}
