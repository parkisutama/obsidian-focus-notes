/**
 * Cognitive Behavioral Therapy reference data shown in the expanded
 * reflection modal as guidance — never as form fields.
 *
 * Two collections:
 *   - CBT_PROMPTS: 6 questions that walk a user through a thought-record
 *     style reflection. Shown as a collapsible list of bullets the user
 *     reads while writing. The user's actual writing all lands in the
 *     single `notes` field; the prompts are scaffolding, not slots.
 *   - COGNITIVE_DISTORTIONS: 10 common thought patterns. Shown as a
 *     second collapsible panel so the user can scan for whichever pattern
 *     matches the automatic thought they just wrote down.
 *
 * Why static data instead of an external file: same reasoning as the mood
 * reference — a stable runtime shape, no parse step, no path-resolution
 * failure mode for first-time users. The dataset is small enough that
 * inlining is preferable to file IO.
 */

export interface CbtPrompt {
    /** Short word for the section header. */
    label: string;
    /** The question itself — what the user reads while writing. */
    question: string;
    /** Optional second-line hint — clarifies what a "good answer" looks like. */
    hint?: string;
}

export const CBT_PROMPTS: CbtPrompt[] = [
    {
        label: "Intensity",
        question: "How strong is the feeling, 1–10?",
        hint: "10 is overwhelming, 1 is barely there. A baseline, not a judgment.",
    },
    {
        label: "Trigger",
        question: "What was the situation or trigger?",
        hint: "Specific event, conversation, thought, or moment. The more concrete, the more workable.",
    },
    {
        label: "Automatic thought",
        question: "What thought arrived first — automatically, instantly?",
        hint: "Catch the words. Often it's a sentence you didn't choose to think.",
    },
    {
        label: "Pattern",
        question: "Does the thought match one of the cognitive distortions below?",
        hint: "Naming the pattern reduces its grip. Multiple patterns can apply at once.",
    },
    {
        label: "Evidence",
        question: "What's the evidence for and against this thought?",
        hint: "An honest jury, not a defense or prosecution. Both sides count.",
    },
    {
        label: "Balanced view",
        question: "What's a more balanced view — without blame?",
        hint: "Not denial, not minimization. A truer description, the kind you'd offer a friend.",
    },
];

export interface CognitiveDistortion {
    /** Lowercase-hyphen canonical key — usable as a tag if the user wants. */
    key: string;
    /** Display name. */
    name: string;
    /** A short example quote that illustrates the pattern. */
    example: string;
    /** One-line description of why the pattern is a distortion. */
    description: string;
}

export const COGNITIVE_DISTORTIONS: CognitiveDistortion[] = [
    {
        key: "all-or-nothing",
        name: "All-or-nothing thinking",
        example: '"This is a complete failure, nothing worked at all."',
        description:
            "Black-and-white categories — perfect or worthless, success or failure. Reality usually lives in shades.",
    },
    {
        key: "overgeneralization",
        name: "Overgeneralization",
        example: '"This never works. It always goes wrong."',
        description: 'Treating a single event as a universal pattern. "Always" and "never" are flags.',
    },
    {
        key: "catastrophizing",
        name: "Catastrophizing",
        example: '"This is a disaster. I can\'t handle it."',
        description: "Predicting the worst outcome as if certain, and your inability to cope as if proven.",
    },
    {
        key: "mind-reading",
        name: "Mind reading",
        example: '"They must be disappointed in me. I know they\'re judging me."',
        description:
            "Assuming you know what others think without evidence. The thought feels like knowledge but it's invented.",
    },
    {
        key: "personalization",
        name: "Personalization",
        example: '"This is my fault. I must have caused this."',
        description:
            "Taking responsibility for events outside your control. Other factors usually contributed; you weren't the only cause.",
    },
    {
        key: "labeling",
        name: "Labeling",
        example: "\"I'm stupid. I'm such a failure.\"",
        description:
            "Attaching a global label to yourself or others based on one event. The behavior is data; the label is a leap.",
    },
    {
        key: "emotional-reasoning",
        name: "Emotional reasoning",
        example: '"I feel scared, so it must be dangerous."',
        description:
            "Treating feelings as evidence about reality. Feelings are real; what they imply about the world isn't always true.",
    },
    {
        key: "mental-filter",
        name: "Mental filter",
        example: '"One bad comment ruined everything good that happened."',
        description: "Focusing only on the negative, filtering out the positive. The full picture includes both.",
    },
    {
        key: "minimization",
        name: "Minimization",
        example: "\"It's fine, I can handle it.\" (when you actually can't)",
        description:
            "Downplaying difficult experiences or your own needs. What hurts is information; dismissing it costs more later.",
    },
    {
        key: "blaming-others",
        name: "Blaming others",
        example: '"This is entirely their fault, I had no part in it."',
        description:
            "Assigning all responsibility to others, denying your own contribution. Most situations are co-created.",
    },
];
