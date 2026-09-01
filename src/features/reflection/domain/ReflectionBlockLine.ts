import type { EmotionCategory, StressLevel } from "./Wellbeing.ts";

export interface ReflectionBlockFields {
    stressLevel: StressLevel | null;
    emotionCategory: EmotionCategory | null;
    emotionKey: string | null;
}

const STRESS_LEVELS: ReadonlySet<string> = new Set(["low", "normal", "medium", "high"]);
const EMOTION_CATEGORIES: ReadonlySet<string> = new Set(["pleasant", "neutral", "unpleasant"]);

const REFLECTION_LABEL_RE = /^reflection:\s*(.*)$/i;

/**
 * Parses the payload of one keyed `- reflection: ...` child. The caller owns indentation and
 * therefore ownership; this module owns only the wellbeing fields on the line.
 */
export function parseReflectionLabel(payload: string): ReflectionBlockFields | null {
    const match = payload.match(REFLECTION_LABEL_RE);
    if (!match) return null;
    const fields: ReflectionBlockFields = { stressLevel: null, emotionCategory: null, emotionKey: null };
    for (const segment of match[1] ? match[1].split(" | ") : []) {
        const separator = segment.indexOf(":");
        if (separator === -1) continue;
        const key = segment.slice(0, separator).trim().toLowerCase();
        const value = segment.slice(separator + 1).trim();
        if (key === "stress" && STRESS_LEVELS.has(value.toLowerCase())) {
            fields.stressLevel = value.toLowerCase() as StressLevel;
        } else if (key === "emotion" && EMOTION_CATEGORIES.has(value.toLowerCase())) {
            fields.emotionCategory = value.toLowerCase() as EmotionCategory;
        } else if (key === "mood" && value) {
            fields.emotionKey = value;
        }
    }
    return fields;
}

/** Renders one canonical keyed Reflection line. */
export function formatReflectionLabelLine(indent: string, fields: ReflectionBlockFields): string {
    const segments: string[] = [];
    if (fields.stressLevel) segments.push(`stress:${fields.stressLevel}`);
    if (fields.emotionCategory) segments.push(`emotion:${fields.emotionCategory}`);
    if (fields.emotionKey) segments.push(`mood:${fields.emotionKey}`);
    return `${indent}- reflection:${segments.length ? ` ${segments.join(" | ")}` : ""}`;
}

export function reflectionFieldsPresent(fields: ReflectionBlockFields): boolean {
    return fields.stressLevel !== null || fields.emotionCategory !== null || fields.emotionKey !== null;
}
