import {
    classifyScheduledItemBlockId,
    createDerivedBlockId,
    extractScheduledItemBlockId,
} from "../../capture/scheduled-item/domain/ScheduledItemBlockId.ts";
import type { EmotionCategory, StressLevel } from "../../reflection/domain/Wellbeing.ts";
import type { DisplayMode } from "./Timer.ts";

const DISPLAY_MODES: readonly DisplayMode[] = ["pomodoro", "timer", "stopwatch"];
const STRESS_LEVELS: readonly StressLevel[] = ["low", "normal", "medium", "high"];
const EMOTION_CATEGORIES: readonly EmotionCategory[] = ["pleasant", "neutral", "unpleasant"];

export interface FocusSessionLineFields {
    start: string;
    end: string;
    durationSeconds: number;
    mode: DisplayMode;
    sessionId: string;
    /**
     * Reflection fields, absent on a freshly-stopped session that skipped them and addable later
     * via Edit Session. Kept out of `notes` — that's a separate indented child line, not part of
     * this single-line grammar (see FocusSessionBlockScan for how the two are stitched together).
     */
    stressLevel?: StressLevel | null;
    emotionCategory?: EmotionCategory | null;
    emotionKey?: string | null;
}

export interface ParsedFocusSessionLine {
    start: string;
    end: string;
    durationSeconds: number;
    mode: DisplayMode;
    sessionId: string;
    stressLevel: StressLevel | null;
    emotionCategory: EmotionCategory | null;
    emotionKey: string | null;
}

export type ParseFocusSessionLineReason = "missing-id" | "invalid-duration" | "invalid-mode";

export type ParseFocusSessionLineResult =
    | { status: "parsed"; session: ParsedFocusSessionLine }
    | { status: "invalid"; reason: ParseFocusSessionLineReason }
    | { status: "not-focus-session" };

// The three reflection fields are each independently optional, in this fixed relative order —
// formatFocusSessionLine only ever emits a present subset in this same order, so a missing field
// simply fails its own literal-keyword match and the parse falls through to the next group.
const FOCUS_SESSION_RE =
    /^-\s+focus-session\s*\|\s*start:(.+?)\s*\|\s*end:(.+?)\s*\|\s*duration:(.+?)\s*\|\s*mode:(.+?)(?:\s*\|\s*stress:(.+?))?(?:\s*\|\s*emotion:(.+?))?(?:\s*\|\s*mood:(.+?))?\s*$/;

/**
 * A `focus-session` child line never states its own owner — like `timebox` lines, ownership
 * comes from tree position (nested under an Event line or a Task timebox line), resolved by the
 * caller walking the block, not encoded here. This keeps the grammar identical regardless of
 * which kind of Scheduled Item owns the session.
 */
export function formatFocusSessionLine(fields: FocusSessionLineFields, indent = "    "): string {
    let line = `${indent}- focus-session | start:${fields.start} | end:${fields.end} | duration:${formatCompactDuration(fields.durationSeconds)} | mode:${fields.mode}`;
    if (fields.stressLevel) line += ` | stress:${fields.stressLevel}`;
    if (fields.emotionCategory) line += ` | emotion:${fields.emotionCategory}`;
    if (fields.emotionKey) line += ` | mood:${fields.emotionKey}`;
    return `${line} ^${fields.sessionId}`;
}

export function parseFocusSessionLine(line: string): ParseFocusSessionLineResult {
    const { semanticLine, blockId } = extractScheduledItemBlockId(line);
    const match = semanticLine.trim().match(FOCUS_SESSION_RE);
    if (!match) return { status: "not-focus-session" };
    if (!blockId || classifyScheduledItemBlockId(blockId) !== "focus-session") {
        return { status: "invalid", reason: "missing-id" };
    }

    const [, start, end, durationText, modeText, stressText, emotionText, moodText] = match;
    const durationSeconds = parseCompactDuration(durationText);
    if (durationSeconds === null) return { status: "invalid", reason: "invalid-duration" };
    if (!DISPLAY_MODES.includes(modeText as DisplayMode)) return { status: "invalid", reason: "invalid-mode" };

    // Optional fields degrade to absent rather than invalidating the whole line — an unrecognized
    // stress/emotion value (e.g. from a future plugin version) shouldn't break parsing today.
    const stressLevel = STRESS_LEVELS.includes(stressText as StressLevel) ? (stressText as StressLevel) : null;
    const emotionCategory = EMOTION_CATEGORIES.includes(emotionText as EmotionCategory)
        ? (emotionText as EmotionCategory)
        : null;
    const emotionKey = moodText?.trim() || null;

    return {
        status: "parsed",
        session: {
            start,
            end,
            durationSeconds,
            mode: modeText as DisplayMode,
            sessionId: blockId,
            stressLevel,
            emotionCategory,
            emotionKey,
        },
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
