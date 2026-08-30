import {
    classifyScheduledItemBlockId,
    createDerivedBlockId,
    extractScheduledItemBlockId,
} from "../../capture/scheduled-item/domain/ScheduledItemBlockId.ts";
import type { DisplayMode } from "./Timer.ts";

const DISPLAY_MODES: readonly DisplayMode[] = ["pomodoro", "timer", "stopwatch"];

export interface FocusSessionLineFields {
    start: string;
    end: string;
    durationSeconds: number;
    mode: DisplayMode;
    sessionId: string;
}

export interface ParsedFocusSessionLine {
    start: string;
    end: string;
    durationSeconds: number;
    mode: DisplayMode;
    sessionId: string;
}

export type ParseFocusSessionLineReason = "missing-id" | "invalid-duration" | "invalid-mode";

export type ParseFocusSessionLineResult =
    | { status: "parsed"; session: ParsedFocusSessionLine }
    | { status: "invalid"; reason: ParseFocusSessionLineReason }
    | { status: "not-focus-session" };

const FOCUS_SESSION_RE =
    /^-\s+focus-session\s*\|\s*start:(.+?)\s*\|\s*end:(.+?)\s*\|\s*duration:(.+?)\s*\|\s*mode:(.+?)$/;

/**
 * A `focus-session` child line never states its own owner — like `timebox` lines, ownership
 * comes from tree position (nested under an Event line or a Task timebox line), resolved by the
 * caller walking the block, not encoded here. This keeps the grammar identical regardless of
 * which kind of Scheduled Item owns the session.
 */
export function formatFocusSessionLine(fields: FocusSessionLineFields, indent = "    "): string {
    return `${indent}- focus-session | start:${fields.start} | end:${fields.end} | duration:${formatCompactDuration(fields.durationSeconds)} | mode:${fields.mode} ^${fields.sessionId}`;
}

export function parseFocusSessionLine(line: string): ParseFocusSessionLineResult {
    const { semanticLine, blockId } = extractScheduledItemBlockId(line);
    const match = semanticLine.trim().match(FOCUS_SESSION_RE);
    if (!match) return { status: "not-focus-session" };
    if (!blockId || classifyScheduledItemBlockId(blockId) !== "focus-session") {
        return { status: "invalid", reason: "missing-id" };
    }

    const [, start, end, durationText, modeText] = match;
    const durationSeconds = parseCompactDuration(durationText);
    if (durationSeconds === null) return { status: "invalid", reason: "invalid-duration" };
    if (!DISPLAY_MODES.includes(modeText as DisplayMode)) return { status: "invalid", reason: "invalid-mode" };

    return {
        status: "parsed",
        session: { start, end, durationSeconds, mode: modeText as DisplayMode, sessionId: blockId },
    };
}

export function createFocusSessionId(createId: () => string = () => createDerivedBlockId("focus")): string {
    return createId();
}

function formatCompactDuration(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}h${m > 0 ? ` ${m}m` : ""}`;
    if (m > 0) return `${m}m${s > 0 ? ` ${s}s` : ""}`;
    return `${s}s`;
}

function parseCompactDuration(value: string): number | null {
    const match = value.match(/^(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?$/);
    if (!match || (!match[1] && !match[2] && !match[3])) return null;
    const hours = Number(match[1] ?? 0);
    const minutes = Number(match[2] ?? 0);
    const seconds = Number(match[3] ?? 0);
    return hours * 3600 + minutes * 60 + seconds;
}
