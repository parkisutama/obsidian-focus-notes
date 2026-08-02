import type { EmotionCategory, StressLevel } from "./types";

export const STRESS_OPTIONS: Array<{ level: StressLevel; label: string }> = [
    { level: "low", label: "Low" },
    { level: "normal", label: "Normal" },
    { level: "medium", label: "Medium" },
    { level: "high", label: "High" },
];

export const EMOTION_GROUPS: Array<{ category: EmotionCategory; label: string; keys: string[] }> = [
    {
        category: "unpleasant",
        label: "Unpleasant",
        keys: [
            "anxious",
            "overwhelmed",
            "frustrated",
            "stressed",
            "restless",
            "irritable",
            "tense",
            "scattered",
            "worried",
            "defensive",
            "drained",
            "stuck",
            "sad",
            "apathetic",
            "lethargic",
        ],
    },
    {
        category: "neutral",
        label: "Neutral",
        keys: ["calm", "reflective", "present", "at-ease", "flat", "bored", "foggy", "disconnected"],
    },
    {
        category: "pleasant",
        label: "Pleasant",
        keys: [
            "inspired",
            "motivated",
            "excited",
            "confident",
            "curious",
            "in-flow",
            "energized",
            "determined",
            "engaged",
            "playful",
            "content",
            "satisfied",
            "peaceful",
            "grateful",
            "relaxed",
            "hopeful",
        ],
    },
];

export function getEmotionCategoryLabel(category: EmotionCategory | null): string {
    return EMOTION_GROUPS.find((group) => group.category === category)?.label ?? "";
}

export function getStressLevelLabel(level: StressLevel | null): string {
    return STRESS_OPTIONS.find((option) => option.level === level)?.label ?? "";
}
