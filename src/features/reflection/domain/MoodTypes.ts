/** Stable types for the Reflection mood and somatic reference catalogs. */

export type Quadrant = "high-pleasant" | "high-unpleasant" | "low-pleasant" | "low-unpleasant";

export type Valence = "pleasant" | "unpleasant";
export type Arousal = "high" | "low";

export interface MoodEntry {
    /** Lowercase-hyphen canonical key. Used in tokens and tags. */
    key: string;
    /** Display name (Title Case). */
    name: string;
    quadrant: Quadrant;
    valence: Valence;
    arousal: Arousal;
    emoji: string;
    /** Tags from the reference doc. First is the canonical primary tag. */
    keywords: string[];
    /** One-line cognitive/relational meaning for tooltip + card. */
    definition: string;
    /** Top three diagnostic somatic signals — what the body is doing. */
    somaticHints: string[];
    /** One-line, evidence-grounded 2-minute intervention. */
    quickAction: string;
    /** What recurrence of this state asks the user to investigate. */
    healingNote: string;
}

/**
 * One row in the somatic-first lookup table. The disambiguation question
 * lifts one of the three meta-questions — valence, direction, or attention —
 * and is shown above the candidate cards when the candidates split cleanly
 * along that dimension. When they don't, `disambiguation` is omitted and the
 * user picks by definition resonance alone.
 */
export interface SensationRow {
    sensation: string;
    candidateKeys: string[];
    disambiguation?: {
        prompt: string;
        /** Optional explicit split — left bucket and right bucket of keys. */
        leftLabel?: string;
        leftKeys?: string[];
        rightLabel?: string;
        rightKeys?: string[];
    };
}

export interface BodyRegion {
    key: string;
    name: string;
    emoji: string;
    sensations: SensationRow[];
}

export interface QuadrantMeta {
    key: Quadrant;
    name: string;
    /** Short axis label, e.g. "Activated · Pleasant". */
    axisLabel: string;
    description: string;
}
