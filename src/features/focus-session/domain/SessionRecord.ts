import type { DisplayMode } from "./Timer";
import type { EmotionCategory, StressLevel } from "../../reflection/domain/Wellbeing";

/** What gets passed to NoteWriter when a session ends. */
export interface SessionRecord {
    mode: DisplayMode;
    startTime: Date;
    endTime: Date;
    durationSeconds: number;
    /** Planned countdown length in seconds; null for stopwatch. */
    plannedSeconds: number | null;
    /** "What are you doing" — free text or a [[wikilink]]. */
    task: string;
    /** Reflection and notes — single field, head/heart/hand is just guidance. */
    notes: string;
    /** Selected stress level from Emotional Wellbeing, or null if skipped. */
    stressLevel: StressLevel | null;
    /** Unpleasant / Neutral / Pleasant category from Emotional Wellbeing. */
    emotionCategory: EmotionCategory | null;
    /** Specific emotion state from MoodReference, or null if user skipped. */
    moodKey: string | null;
    /**
     * Comma-separated wikilinks added in the modal's Related field.
     * Stored as the raw string the user typed; rendering joins them with spaces.
     */
    links: string;
    /**
     * `[[file#^sessionId]]` back to the canonical Focus Session child line, or "" for an
     * unowned/legacy session. Available as {{canonicalLink}} in the log templates; not part of
     * the default templates, so existing users' logs render unchanged unless they opt in.
     */
    canonicalLink: string;
}
