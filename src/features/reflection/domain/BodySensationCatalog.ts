import type { BodyRegion } from "./MoodTypes.ts";

/** Somatic-first lookup catalog. Candidate keys refer to MoodCatalog entries. */
/**
 * Disambiguation question selection follows three meta-questions from the
 * reference doc:
 *   - Valence appraisal: threatening vs welcoming
 *   - Direction appraisal: absent vs present
 *   - Attention quality: circling vs moving forward
 *
 * Where the candidate set splits cleanly along one of these axes, we attach
 * the question with explicit left/right buckets so the UI can offer a
 * one-tap split. Where it doesn't (e.g. three states all sharing valence
 * and arousal), we omit the question and let the user pick by definition.
 */
export const BODY_REGIONS: BodyRegion[] = [
    {
        key: "chest",
        name: "Chest",
        emoji: "🫀",
        sensations: [
            {
                sensation: "Tightness or constriction",
                candidateKeys: ["anxious", "stressed", "tense", "defensive"],
                disambiguation: {
                    prompt: "Is your mind circling about something uncertain, or holding without specific cause?",
                    leftLabel: "Circling",
                    leftKeys: ["anxious", "defensive"],
                    rightLabel: "Holding",
                    rightKeys: ["stressed", "tense"],
                },
            },
            {
                sensation: "Warmth or expansion",
                candidateKeys: ["inspired", "grateful", "hopeful", "present"],
                disambiguation: {
                    prompt: "Is something arriving now, or being anticipated?",
                    leftLabel: "Arriving",
                    leftKeys: ["inspired", "grateful", "present"],
                    rightLabel: "Anticipated",
                    rightKeys: ["hopeful"],
                },
            },
            {
                sensation: "Heaviness",
                candidateKeys: ["sad", "drained", "disconnected", "flat"],
                disambiguation: {
                    prompt: "Is something missing, or is your energy depleted?",
                    leftLabel: "Missing",
                    leftKeys: ["sad", "disconnected"],
                    rightLabel: "Depleted",
                    rightKeys: ["drained", "flat"],
                },
            },
            {
                sensation: "Light, open quality",
                candidateKeys: ["calm", "at-ease", "relaxed", "peaceful"],
                // No disambiguation — these are nuance-distinguished by context.
            },
            {
                sensation: "Fluttery or hollow",
                candidateKeys: ["anxious", "excited", "worried"],
                disambiguation: {
                    prompt: "Does this feel threatening or welcoming?",
                    leftLabel: "Threatening",
                    leftKeys: ["anxious", "worried"],
                    rightLabel: "Welcoming",
                    rightKeys: ["excited"],
                },
            },
            {
                sensation: "Puffed or braced",
                candidateKeys: ["defensive", "determined", "confident"],
                disambiguation: {
                    prompt: "Are you protecting against something, or moving toward something?",
                    leftLabel: "Protecting",
                    leftKeys: ["defensive"],
                    rightLabel: "Moving toward",
                    rightKeys: ["determined", "confident"],
                },
            },
        ],
    },
    {
        key: "shoulders",
        name: "Shoulders",
        emoji: "💪",
        sensations: [
            {
                sensation: "Drawn up toward ears",
                candidateKeys: ["tense", "anxious", "stressed", "overwhelmed"],
                disambiguation: {
                    prompt: "Acute load or chronic load?",
                    leftLabel: "Acute",
                    leftKeys: ["anxious", "overwhelmed"],
                    rightLabel: "Chronic",
                    rightKeys: ["stressed", "tense"],
                },
            },
            {
                sensation: "Dropped and heavy",
                candidateKeys: ["relaxed", "drained", "lethargic"],
                disambiguation: {
                    prompt: "Does this feel restorative or depleted?",
                    leftLabel: "Restorative",
                    leftKeys: ["relaxed"],
                    rightLabel: "Depleted",
                    rightKeys: ["drained", "lethargic"],
                },
            },
            {
                sensation: "Rolled forward (protective)",
                candidateKeys: ["overwhelmed", "sad", "disconnected", "flat"],
            },
            {
                sensation: "Broad, open, easy",
                candidateKeys: ["confident", "energized", "calm"],
            },
            {
                sensation: "Persistent ache",
                candidateKeys: ["stressed", "tense"],
            },
        ],
    },
    {
        key: "jaw",
        name: "Jaw and Face",
        emoji: "😬",
        sensations: [
            {
                sensation: "Clenched, teeth pressing",
                candidateKeys: ["frustrated", "tense", "irritable", "stressed"],
                disambiguation: {
                    prompt: "Is there a visible obstacle, or is the cause unclear?",
                    leftLabel: "Visible obstacle",
                    leftKeys: ["frustrated"],
                    rightLabel: "Unclear cause",
                    rightKeys: ["tense", "irritable", "stressed"],
                },
            },
            {
                sensation: "Loose, jaw open or easy",
                candidateKeys: ["relaxed", "at-ease", "present"],
            },
            {
                sensation: "Hot flush, face warming",
                candidateKeys: ["frustrated", "defensive", "excited"],
                disambiguation: {
                    prompt: "Does this feel threatening or welcoming?",
                    leftLabel: "Threatening",
                    leftKeys: ["frustrated", "defensive"],
                    rightLabel: "Welcoming",
                    rightKeys: ["excited"],
                },
            },
            {
                sensation: "Expressionless at rest",
                candidateKeys: ["flat", "disconnected", "apathetic"],
            },
            {
                sensation: "Animated, moving with thought",
                candidateKeys: ["engaged", "curious", "excited", "playful"],
            },
        ],
    },
    {
        key: "breath",
        name: "Breath",
        emoji: "🌬️",
        sensations: [
            {
                sensation: "Shallow, chest-only",
                candidateKeys: ["anxious", "stressed", "tense", "overwhelmed"],
            },
            {
                sensation: "Full, held at top",
                candidateKeys: ["excited", "tense"],
                disambiguation: {
                    prompt: "Does this feel welcoming or held?",
                    leftLabel: "Welcoming",
                    leftKeys: ["excited"],
                    rightLabel: "Held",
                    rightKeys: ["tense"],
                },
            },
            {
                sensation: "Slow, low (belly)",
                candidateKeys: ["calm", "relaxed", "peaceful", "reflective"],
            },
            {
                sensation: "Frequent sighing",
                candidateKeys: ["sad", "worried", "drained", "disconnected"],
            },
            {
                sensation: "Even, unnoticed",
                candidateKeys: ["in-flow", "content", "present"],
            },
            {
                sensation: "Tight, restricted",
                candidateKeys: ["defensive", "anxious"],
            },
        ],
    },
    {
        key: "stomach",
        name: "Stomach and Gut",
        emoji: "🫃",
        sensations: [
            {
                sensation: "Butterflies or hollow",
                candidateKeys: ["anxious", "excited", "worried"],
                disambiguation: {
                    prompt: "Does this feel threatening or welcoming?",
                    leftLabel: "Threatening",
                    leftKeys: ["anxious", "worried"],
                    rightLabel: "Welcoming",
                    rightKeys: ["excited"],
                },
            },
            {
                sensation: "Tight, nauseated",
                candidateKeys: ["stressed", "overwhelmed", "anxious"],
            },
            {
                sensation: "Soft and easy",
                candidateKeys: ["relaxed", "calm", "at-ease"],
            },
            {
                sensation: "Empty, waiting quality",
                candidateKeys: ["worried", "sad", "disconnected"],
            },
            {
                sensation: "Settled, full warmth",
                candidateKeys: ["content", "grateful", "satisfied"],
            },
            {
                sensation: "No sensation at all",
                candidateKeys: ["flat", "apathetic"],
            },
        ],
    },
    {
        key: "legs",
        name: "Legs and Feet",
        emoji: "🦶",
        sensations: [
            {
                sensation: "Bouncing, tapping",
                candidateKeys: ["restless", "anxious", "excited"],
                disambiguation: {
                    prompt: "Does this feel threatening or welcoming?",
                    leftLabel: "Threatening",
                    leftKeys: ["restless", "anxious"],
                    rightLabel: "Welcoming",
                    rightKeys: ["excited"],
                },
            },
            {
                sensation: "Light, springy quality",
                candidateKeys: ["playful", "energized", "excited"],
            },
            {
                sensation: "Heavy, effortful",
                candidateKeys: ["drained", "lethargic", "sad"],
            },
            {
                sensation: "Rooted, stable",
                candidateKeys: ["calm", "confident", "determined"],
            },
            {
                sensation: "Urge to move or stand",
                candidateKeys: ["restless", "bored", "inspired"],
                disambiguation: {
                    prompt: "Is your mind circling, or moving forward?",
                    leftLabel: "Circling",
                    leftKeys: ["restless", "bored"],
                    rightLabel: "Moving forward",
                    rightKeys: ["inspired"],
                },
            },
        ],
    },
    {
        key: "eyes",
        name: "Eyes and Gaze",
        emoji: "👀",
        sensations: [
            {
                sensation: "Scanning, darting",
                candidateKeys: ["anxious", "scattered", "restless"],
            },
            {
                sensation: "Soft, wide, peripheral",
                candidateKeys: ["calm", "present", "grateful", "relaxed"],
            },
            {
                sensation: "Unfocused, distant",
                candidateKeys: ["foggy", "worried", "reflective", "drained"],
                disambiguation: {
                    prompt: "Is your mind circling, or moving forward?",
                    leftLabel: "Circling",
                    leftKeys: ["worried", "foggy"],
                    rightLabel: "Moving forward",
                    rightKeys: ["reflective"],
                },
            },
            {
                sensation: "Absorbed, not drifting",
                candidateKeys: ["in-flow", "engaged", "motivated"],
            },
            {
                sensation: "Heavy, wanting to close",
                candidateKeys: ["drained", "lethargic", "sad"],
            },
            {
                sensation: "Bright, vivid",
                candidateKeys: ["energized", "excited", "inspired", "present"],
            },
        ],
    },
    {
        key: "hands",
        name: "Hands",
        emoji: "✋",
        sensations: [
            {
                sensation: "Clenched or gripping",
                candidateKeys: ["frustrated", "stressed", "tense", "determined"],
                disambiguation: {
                    prompt: "Are you blocked, or moving toward something?",
                    leftLabel: "Blocked",
                    leftKeys: ["frustrated", "stressed", "tense"],
                    rightLabel: "Moving toward",
                    rightKeys: ["determined"],
                },
            },
            {
                sensation: "Fidgeting, restless",
                candidateKeys: ["anxious", "restless", "bored", "scattered"],
            },
            {
                sensation: "Cool, slightly trembling",
                candidateKeys: ["anxious", "excited"],
                disambiguation: {
                    prompt: "Does this feel threatening or welcoming?",
                    leftLabel: "Threatening",
                    leftKeys: ["anxious"],
                    rightLabel: "Welcoming",
                    rightKeys: ["excited"],
                },
            },
            {
                sensation: "Open, relaxed",
                candidateKeys: ["calm", "relaxed", "at-ease", "content"],
            },
            {
                sensation: "Purposeful, active",
                candidateKeys: ["motivated", "engaged", "in-flow"],
            },
            {
                sensation: "Heavy in lap",
                candidateKeys: ["drained", "flat", "lethargic"],
            },
        ],
    },
];
