/**
 * Mood reference: Russell's Circumplex Model with somatic-first lookup.
 *
 * Source of truth: interstitial-mood-reference.md (compressed for runtime).
 * Each mood is positioned on two independent axes:
 *   - Valence: pleasant ↔ unpleasant
 *   - Arousal: high ↔ low
 * Yielding four quadrants the picker UI organises around.
 *
 * Why static data instead of reading the reference doc at runtime:
 *   The reference is authored prose for humans; the runtime needs a stable
 *   schema and predictable keys for templating ({{moodKey}}, {{moodEmoji}}).
 *   Encoding it once here avoids both a parse step and a sync hazard between
 *   doc revisions and code expectations.
 */

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

// ---------------------------------------------------------------------------
// MOODS
// ---------------------------------------------------------------------------

export const MOODS: Record<string, MoodEntry> = {
    // ---- High arousal / Unpleasant -----------------------------------------
    anxious: {
        key: "anxious",
        name: "Anxious",
        quadrant: "high-unpleasant",
        valence: "unpleasant",
        arousal: "high",
        emoji: "😰",
        keywords: ["anxiety", "threat-scan", "uncertainty", "rumination", "what-if"],
        definition:
            "Threat-scanning mode with uncertain outcome. Physiologically indistinguishable from excitement — the interpretive frame differs.",
        somaticHints: [
            "Chest tightness or shallow breathing",
            "Butterflies or hollow stomach",
            "Eyes darting, hard to hold focus",
        ],
        quickAction: "Physiological sigh × 2: double inhale through nose, long slow exhale through mouth.",
        healingNote:
            "Recurring anxiety often guards an unmet need for safety. Ask: what would have to be true for me to feel safe right now?",
    },
    overwhelmed: {
        key: "overwhelmed",
        name: "Overwhelmed",
        quadrant: "high-unpleasant",
        valence: "unpleasant",
        arousal: "high",
        emoji: "🤯",
        keywords: ["capacity", "overload", "triage", "too-many-tabs", "cognitive-load"],
        definition:
            "Working-memory triage exceeded. Too many open loops competing for the same resources. Pushing harder is counterproductive.",
        somaticHints: [
            "Pressure behind eyes or across forehead",
            "Shoulders drawn forward and up",
            "Breath stops mid-inhale, resets with a sigh",
        ],
        quickAction:
            "Brain dump: write every open loop, one line each. No organization. Then pick the single next action.",
        healingNote:
            "Overwhelm recurring at the same point in cycles often signals a boundary that hasn't been set, not a capacity problem.",
    },
    frustrated: {
        key: "frustrated",
        name: "Frustrated",
        quadrant: "high-unpleasant",
        valence: "unpleasant",
        arousal: "high",
        emoji: "😤",
        keywords: ["blocked", "obstacle", "goal-proximity", "impasse", "friction"],
        definition:
            "Goal-directed motion blocked by an obstacle that feels close and surmountable. The system believes progress is possible.",
        somaticHints: [
            "Heat in face, neck, or chest",
            "Teeth pressing together, hands gripping",
            "Rapid shallow breathing, foot tapping",
        ],
        quickAction: 'Name the obstacle in one specific sentence: "I am frustrated because [X] is preventing [Y]."',
        healingNote:
            "Chronic frustration often hides perfectionism: the obstacle is a gap between reality and an unexamined standard.",
    },
    stressed: {
        key: "stressed",
        name: "Stressed",
        quadrant: "high-unpleasant",
        valence: "unpleasant",
        arousal: "high",
        emoji: "😣",
        keywords: ["demand", "capacity", "pressure", "chronic", "sustained-load"],
        definition:
            "Sustained perception that demand exceeds capacity. The chronic pattern, distinct from acute overwhelm.",
        somaticHints: [
            "Persistent shoulder/upper-back tension",
            "Headache at base of skull or temples",
            "Disrupted sleep even when tired",
        ],
        quickAction: "Body scan from scalp down. Release jaw, shoulders, hands consciously.",
        healingNote:
            "Stress requires structural resolution. If breath and scans aren't enough, the demand itself needs to change.",
    },
    restless: {
        key: "restless",
        name: "Restless",
        quadrant: "high-unpleasant",
        valence: "unpleasant",
        arousal: "high",
        emoji: "😖",
        keywords: ["unfocused-energy", "urge-to-move", "task-switching", "activation", "no-outlet"],
        definition:
            "High energy without a clear direction or permissible outlet. Often misread as procrastination — it's unexpressed activation.",
        somaticHints: [
            "Leg bouncing, foot tapping, finger drumming",
            "Urge to stand, pace, change location",
            "Eyes won't stay on screen",
        ],
        quickAction: "Five minutes of physical permission: stand, walk, stretch, shake hands and arms.",
        healingNote: "Restlessness at consistent times of day often signals a circadian mismatch with sit-still work.",
    },
    irritable: {
        key: "irritable",
        name: "Irritable",
        quadrant: "high-unpleasant",
        valence: "unpleasant",
        arousal: "high",
        emoji: "😠",
        keywords: ["low-threshold", "needs-unmet", "hair-trigger", "reactive", "depletion"],
        definition:
            "Threshold for provocation has lowered. Rarely about the immediate trigger — typically a basic need (sleep, food, rest) is unmet.",
        somaticHints: [
            "Skin sensitivity — clothing wrong, sounds loud",
            "Clenched jaw revealed only on checking",
            "Sharpness in voice noticed after speaking",
        ],
        quickAction:
            "Before responding to anything: when did I last eat? sleep enough? have water? Address the missing one.",
        healingNote:
            "Recurring irritability in specific contexts often points at an unexpressed need or accumulated resentment in that context.",
    },
    tense: {
        key: "tense",
        name: "Tense",
        quadrant: "high-unpleasant",
        valence: "unpleasant",
        arousal: "high",
        emoji: "😬",
        keywords: ["somatic", "held-activation", "incomplete", "preparatory", "body-holding"],
        definition:
            "Body holding preparatory activation without discharge. Physical mobilization for action that hasn't happened yet.",
        somaticHints: ["Shoulders drawn up toward ears", "Jaw firm even at rest", "Breath held at top of inhale"],
        quickAction: "Progressive release: shrug shoulders → release; clench fists → release; jaw open wide → relax.",
        healingNote:
            "Frequent tense suggests the body is carrying something the mind hasn't articulated. Body-scan journaling will surface it.",
    },
    scattered: {
        key: "scattered",
        name: "Scattered",
        quadrant: "high-unpleasant",
        valence: "unpleasant",
        arousal: "high",
        emoji: "🌀",
        keywords: ["attention", "distraction", "focus-fragmented", "context-switching", "shallow-processing"],
        definition:
            "Attention fragmented across competing threads, none receiving depth. Pre-flow blocker — the gateway before focus collapses.",
        somaticHints: [
            "Eyes moving across screen without reading",
            "Opening multiple windows before finishing one",
            "Midsentence pauses where the thread is lost",
        ],
        quickAction: "Single-window constraint. Write the single next action on paper before opening anything.",
        healingNote:
            "Scattered as default state diagnoses environment, not character. Input management is the prescription.",
    },
    worried: {
        key: "worried",
        name: "Worried",
        quadrant: "high-unpleasant",
        valence: "unpleasant",
        arousal: "high",
        emoji: "😟",
        keywords: ["future-oriented", "rumination", "worst-case", "scenario-rehearsal", "probability-distortion"],
        definition:
            "Future-oriented negative scenario rehearsal. More cognitive (thought loops) than physical (anxiety's activation).",
        somaticHints: [
            "Forehead tension with subtle furrowing",
            "Eyes slightly unfocused, looking through not at",
            "Slow frequent sighing",
        ],
        quickAction: "Write the worry. Estimate its probability 0–100%. Name one concrete step that reduces the risk.",
        healingNote:
            'Resistant worry loops often have a control belief: "if I stop thinking about this, something bad will happen." Examine that belief.',
    },
    defensive: {
        key: "defensive",
        name: "Defensive",
        quadrant: "high-unpleasant",
        valence: "unpleasant",
        arousal: "high",
        emoji: "🛡️",
        keywords: ["identity-threat", "protection-mode", "criticism-response", "ego-defense", "closed-loop"],
        definition:
            "Identity or value perceived as under threat. System shifts from collaboration to protection. Learning stops here.",
        somaticHints: [
            "Chest puffed, arms crossing",
            "Hot flush across face and neck",
            "Tightening in throat — words held back",
        ],
        quickAction:
            'Pause: "let me think about that for a moment." Name the feeling beneath: embarrassment, fear of inadequacy, injustice.',
        healingNote:
            "Defensive activation at specific people or feedback types often traces to earlier wounds around judgment, shame, or invalidation.",
    },

    // ---- High arousal / Pleasant -------------------------------------------
    inspired: {
        key: "inspired",
        name: "Inspired",
        quadrant: "high-pleasant",
        valence: "pleasant",
        arousal: "high",
        emoji: "💡",
        keywords: ["creativity", "novel-connection", "insight", "generative", "emergent"],
        definition:
            "A novel connection has fired. Inherently time-limited — the neural pattern decays quickly and is interrupted by switching tasks.",
        somaticHints: [
            "Sudden alertness — body wakes mid-task",
            "Slight widening of eyes, leaning forward",
            "Warm expansion in the chest",
        ],
        quickAction:
            "Capture raw within 90 seconds. Voice memo, bullet, scratch — format doesn't matter. Refinement is separate.",
        healingNote:
            "Recurring inspiration without follow-through is structural (time, energy protection), not motivational.",
    },
    motivated: {
        key: "motivated",
        name: "Motivated",
        quadrant: "high-pleasant",
        valence: "pleasant",
        arousal: "high",
        emoji: "🚀",
        keywords: ["goal-clarity", "drive", "initiation", "action-ready", "worthwhile"],
        definition:
            "Clear goal, felt urgency, willingness to initiate. Emerges when goal is visible, path is plausible, cost feels worth it.",
        somaticHints: [
            "Upright posture — body is ready",
            "Full easy breathing",
            "Hands purposeful, slight forward lean",
        ],
        quickAction: "Begin within 2 minutes. Don't plan the beginning, just begin. Momentum first, planning after.",
        healingNote:
            "When motivation is absent, one of three is broken: visible goal, plausible path, or felt-worthwhile cost.",
    },
    excited: {
        key: "excited",
        name: "Excited",
        quadrant: "high-pleasant",
        valence: "pleasant",
        arousal: "high",
        emoji: "🤩",
        keywords: ["activation", "anticipation", "positive-arousal", "looking-forward", "energized-positive"],
        definition:
            "Positive activation toward a specific anticipated thing. Same arousal as anxious — the difference is the appraised valence.",
        somaticHints: [
            "Light fluttery feeling in chest or stomach",
            "Quick uplifted breathing",
            "Animated face, faster speech",
        ],
        quickAction:
            "Channel the activation toward the thing that produced it. Write what specifically excites you in one sentence.",
        healingNote:
            "Excitement at non-pursuable things is information about values. Track what excites you — that data is a compass.",
    },
    confident: {
        key: "confident",
        name: "Confident",
        quadrant: "high-pleasant",
        valence: "pleasant",
        arousal: "high",
        emoji: "💪",
        keywords: ["self-trust", "capability-felt", "agency", "high-stakes-ready", "settled-power"],
        definition:
            "Felt sense that current capability matches current demand. Best state for high-stakes decisions and difficult conversations.",
        somaticHints: [
            "Broad open shoulders, unhurried breath",
            "Steady eye contact",
            "Movement is deliberate without strain",
        ],
        quickAction:
            "Take on the hardest item on your list. This is the state to spend on demanding work, not low-stakes maintenance.",
        healingNote:
            "Confidence that evaporates only socially traces to a belief about visibility/judgment. Capability is real; the belief is the layer to examine.",
    },
    curious: {
        key: "curious",
        name: "Curious",
        quadrant: "high-pleasant",
        valence: "pleasant",
        arousal: "high",
        emoji: "🔍",
        keywords: ["exploration", "open-ended", "discovery", "learning-mode", "non-linear"],
        definition:
            "Open information-seeking without predetermined conclusion. Ideal for research, learning, problem reframing.",
        somaticHints: [
            "Head tilts slightly to one side",
            "Eyes wide and slightly unfocused",
            "Questions arise faster than answers",
        ],
        quickAction:
            "25-minute window for unstructured exploration. Resist forcing a conclusion — curiosity collapses if pressured.",
        healingNote:
            "Adults lose curiosity in domains where they were judged or failed publicly. Curiosity-absent areas are often guarded by old shame.",
    },
    "in-flow": {
        key: "in-flow",
        name: "In Flow",
        quadrant: "high-pleasant",
        valence: "pleasant",
        arousal: "high",
        emoji: "🌊",
        keywords: ["peak-attention", "effortless", "full-engagement", "skill-challenge-balance", "intrinsic"],
        definition:
            "Effortless attention, full skill engagement, intrinsic reward from the activity. Cannot be forced — only conditions can be created.",
        somaticHints: [
            "Time passes faster than the clock",
            "No body awareness — hunger, posture disappear",
            "Breath slow and even without intention",
        ],
        quickAction:
            "Protect immediately: notifications off, signal unavailability, close door. Interruption resets the state entirely.",
        healingNote:
            "Log conditions every time flow appears: time, task, environment. Your personal flow conditions are unique — discover them empirically.",
    },
    energized: {
        key: "energized",
        name: "Energized",
        quadrant: "high-pleasant",
        valence: "pleasant",
        arousal: "high",
        emoji: "⚡",
        keywords: ["body-ready", "mind-ready", "vitality", "recovery", "capacity-high"],
        definition:
            "Body and mind both available and ready. Felt experience of adequate recovery meeting meaningful demand.",
        somaticHints: [
            "Deep easy breathing without attention",
            "Bright alert eyes, vivid visual field",
            "Spaciousness in the body",
        ],
        quickAction:
            "Tackle the avoided item. Energized is for full-capacity work — defaulting to low-stakes tasks here is a productivity loss.",
        healingNote:
            "If energized is consistently absent from your log, that's the most actionable wellbeing signal in this taxonomy.",
    },
    determined: {
        key: "determined",
        name: "Determined",
        quadrant: "high-pleasant",
        valence: "pleasant",
        arousal: "high",
        emoji: "🎯",
        keywords: ["grit", "sustained-intent", "commitment", "post-excitement", "persistence"],
        definition:
            "Sustained intent that persists after excitement fades. Operates on commitment, not moment-to-moment reward. Quieter than motivation, more durable.",
        somaticHints: ["Jaw set — purposeful, not clenched", "Steady regular breathing", "Gaze stays on the work"],
        quickAction: "Reduce friction, not effort. Identify and remove one environmental obstacle before continuing.",
        healingNote:
            "Sudden determination collapse often hides an unexpressed need for acknowledgment. Recognize your own effort explicitly.",
    },
    engaged: {
        key: "engaged",
        name: "Engaged",
        quadrant: "high-pleasant",
        valence: "pleasant",
        arousal: "high",
        emoji: "🧠",
        keywords: ["attention-given", "voluntary", "present", "interested", "relational"],
        definition:
            "Full voluntary attention given to current task or person. Conscious version of flow — the choice to be here is felt as positive.",
        somaticHints: [
            "Leaning toward the task or person",
            "Animated face matching content",
            "No urge to check phone or shift context",
        ],
        quickAction:
            "Name what is engaging you in one sentence. Reinforces the state and records the conditions that produce it.",
        healingNote:
            "What engages you without external reward signals your actual interests, vs. performed ones. A month of engagement entries is a values audit.",
    },
    playful: {
        key: "playful",
        name: "Playful",
        quadrant: "high-pleasant",
        valence: "pleasant",
        arousal: "high",
        emoji: "🎈",
        keywords: ["divergent", "exploratory", "low-stakes", "experimental", "non-linear"],
        definition:
            "Constraints temporarily suspended for the pleasure of exploration. The primary state in which creative breakthroughs occur.",
        somaticHints: [
            "Lighter, springier movement",
            "Spontaneous sounds while working",
            "Smiles at unexpected moments",
        ],
        quickAction: "Allow the tangent. Give 10–20 minutes before filtering. Play first, evaluate second.",
        healingNote:
            "Adult loss of playfulness usually traces to environments that punished experimentation. Sustained absence is a signal worth following.",
    },

    // ---- Low arousal / Unpleasant ------------------------------------------
    drained: {
        key: "drained",
        name: "Drained",
        quadrant: "low-unpleasant",
        valence: "unpleasant",
        arousal: "low",
        emoji: "🫠",
        keywords: ["depletion", "resource-exhaustion", "fatigue", "recovery-needed", "post-expenditure"],
        definition:
            "Resources genuinely depleted. Not laziness — exhaustion after expenditure. Override with stimulants borrows against tomorrow.",
        somaticHints: ["Heaviness in limbs", "Eyes dry, heavy, wanting to close", "Monotone voice, slowed movement"],
        quickAction:
            "Categorize the drain: cognitive → gentle movement; emotional → solitude; physical → horizontal rest, water.",
        healingNote:
            "Chronic drained across multiple weeks is burnout staging. The journal timestamp data is critical here.",
    },
    bored: {
        key: "bored",
        name: "Bored",
        quadrant: "low-unpleasant",
        valence: "unpleasant",
        arousal: "low",
        emoji: "😑",
        keywords: ["understimulation", "challenge-gap", "repetition", "disengagement", "mismatch"],
        definition:
            "Insufficient stimulation for current capacity. Mismatch between available challenge and felt capability — not absence of things to do.",
        somaticHints: [
            "Slumped posture — body not invested",
            "Frequent glances away from the task",
            "Yawning without fatigue",
        ],
        quickAction:
            "Add constraint or novelty: aggressive time-box, change format, change location. Boredom responds to method novelty.",
        healingNote:
            "Boredom recurring in specific roles or domains is a fit problem, not a stimulation problem. Honest question: is this work matched to me?",
    },
    foggy: {
        key: "foggy",
        name: "Foggy",
        quadrant: "low-unpleasant",
        valence: "unpleasant",
        arousal: "low",
        emoji: "🌫️",
        keywords: ["working-memory", "cognitive-fatigue", "processing-slow", "clarity-loss", "physiological"],
        definition:
            "Degraded working memory and processing. Almost always physiological: sleep, hydration, glucose, prolonged single-task attention.",
        somaticHints: [
            "Eyes slightly unfocused — fine print harder",
            "Thoughts move through resistance",
            "Words come out transposed",
        ],
        quickAction:
            "Water (250–500ml now), then 5 minutes outdoor light or movement. Defer judgment tasks; do mechanical ones.",
        healingNote:
            "Foggy after the same activity reveals your personal cognitive load signature. Build your schedule around that data.",
    },
    stuck: {
        key: "stuck",
        name: "Stuck",
        quadrant: "low-unpleasant",
        valence: "unpleasant",
        arousal: "low",
        emoji: "🚧",
        keywords: ["impasse", "no-path-visible", "blocked", "framing-problem", "reframe-needed"],
        definition:
            "Forward motion arrested without a named obstacle. The blockage is usually at framing level, not execution level.",
        somaticHints: [
            "Staring at screen without moving",
            "Picking up and putting down the same object",
            "Subtle avoidance of the work",
        ],
        quickAction:
            "Change zoom level. Stuck in execution → zoom out to intent. Stuck in planning → zoom in to first physical action.",
        healingNote:
            "Stuck near completion often signals fear of evaluation or visibility. The work is done enough — the block is about what happens after.",
    },
    disconnected: {
        key: "disconnected",
        name: "Disconnected",
        quadrant: "low-unpleasant",
        valence: "unpleasant",
        arousal: "low",
        emoji: "🔌",
        keywords: ["meaning-gap", "isolation", "purposelessness", "relational-distance", "thread-lost"],
        definition:
            "Felt distance from the work, others, or purpose. The thread connecting present action to meaningful outcome has gone quiet.",
        somaticHints: [
            "Going through motions without presence",
            "Reduced response to usual triggers",
            "Subtle numbness in sensory experience",
        ],
        quickAction:
            "Re-contact with one meaningful thing: read your own past work, re-read why you started, talk briefly with someone whose work touches yours.",
        healingNote:
            "Frequent disconnected often precedes burnout, depression, or major values misalignment. The journal trend is the diagnostic, not any single entry.",
    },
    flat: {
        key: "flat",
        name: "Flat",
        quadrant: "low-unpleasant",
        valence: "unpleasant",
        arousal: "low",
        emoji: "⬜",
        keywords: ["affect-absent", "numbness", "blankness", "no-valence", "monitor"],
        definition:
            "Absent affect — neither positive nor negative pole registers. Not peaceful — the absence of felt experience.",
        somaticHints: [
            "Facial muscles relaxed to expressionlessness",
            "Slow shallow but unstrained breathing",
            "Sensations feel muted",
        ],
        quickAction:
            "Don't force affect. Move slowly, drink water, step outside, contact a texture. Gentle sensory input only.",
        healingNote:
            "Flat is the body's circuit breaker after sustained overload. Sustained flat for more than a few days is a care signal — consider professional support.",
    },
    sad: {
        key: "sad",
        name: "Sad",
        quadrant: "low-unpleasant",
        valence: "unpleasant",
        arousal: "low",
        emoji: "😢",
        keywords: ["loss", "grief", "disappointment", "processing", "something-mattered"],
        definition:
            "Loss or disappointment being processed. Not a malfunction — the appropriate response to something that mattered being absent.",
        somaticHints: [
            "Heaviness in chest or throat",
            "Eyes soft, watery, wanting to close",
            "Posture rounds and folds inward",
        ],
        quickAction:
            "Allow rather than interrupt. Write what the loss is, even one sentence. If a trustworthy person is available, name it to them.",
        healingNote:
            "Old sadness surfaces in response to disproportionately small losses. If a small loss triggers a large response, something older is unprocessed.",
    },
    apathetic: {
        key: "apathetic",
        name: "Apathetic",
        quadrant: "low-unpleasant",
        valence: "unpleasant",
        arousal: "low",
        emoji: "😐",
        keywords: ["meaning-absent", "no-pull", "indifference", "motivational-void", "purpose-disconnection"],
        definition:
            "No felt pull toward anything. Unlike boredom (restless), apathy has no restlessness. Often follows sustained effort toward non-self-determined goals.",
        somaticHints: [
            "Slow heavy movement, no urge to speed up",
            "Neutral expression that doesn't shift",
            "Minimal speech, gaze settles without focus",
        ],
        quickAction:
            "Don't try to solve via task completion. Identify one thing you'd do if there were no obligations. Follow it 20 minutes without justifying.",
        healingNote:
            "Apathy is the clearest signal of sustained autonomy deprivation. Audit: what % of your work is chosen vs. assigned?",
    },
    lethargic: {
        key: "lethargic",
        name: "Lethargic",
        quadrant: "low-unpleasant",
        valence: "unpleasant",
        arousal: "low",
        emoji: "😴",
        keywords: ["physical-depletion", "body-priority", "illness-signal", "sleep-debt", "energy-zero"],
        definition:
            "Physical energy insufficient for normal output. Heavier than drained — actual physiological depletion (illness, sleep debt, nutrition).",
        somaticHints: [
            "Limbs feel weighted",
            "Cognitive processing physiologically slow",
            "Immune signals: lymph awareness, dry throat",
        ],
        quickAction:
            "Rest without screen. Horizontal, 20 minutes non-sleep. The body is asking for recovery, not stimulation.",
        healingNote:
            "Lethargic frequent over weeks independent of illness is a clinical signal. Document the pattern for a healthcare provider.",
    },

    // ---- Low arousal / Pleasant --------------------------------------------
    calm: {
        key: "calm",
        name: "Calm",
        quadrant: "low-pleasant",
        valence: "pleasant",
        arousal: "low",
        emoji: "😌",
        keywords: ["regulated", "settled", "no-urgency", "clear-minded", "baseline-positive"],
        definition:
            "Nervous system regulated and settled. The felt absence of friction. Ideal for deep reading, analytical writing, strategic planning.",
        somaticHints: [
            "Slow even low (belly) breath",
            "Shoulders dropped and easy",
            "Eyes soft, peripheral vision present",
        ],
        quickAction:
            "Use this for steady analytical work, long-form writing, complex reading. Don't waste calm on shallow tasks.",
        healingNote:
            "If calm is hard to access in safe circumstances, the nervous system has habituated to a higher baseline. Somatic practices lower the resting setpoint.",
    },
    content: {
        key: "content",
        name: "Content",
        quadrant: "low-pleasant",
        valence: "pleasant",
        arousal: "low",
        emoji: "🙂",
        keywords: ["needs-met", "sufficient", "baseline-wellbeing", "sustainable", "present-tense"],
        definition:
            "Present needs met; no strong wants pressing. Sustainable baseline of wellbeing — not peak pleasure, just sufficiency.",
        somaticHints: ["Settled warmth in chest", "Regular unhurried breathing", "No urge to check or change anything"],
        quickAction:
            "Acknowledge it explicitly in the journal. A content entry is evidence the system is working — don't let it pass uncounted.",
        healingNote:
            "If content feels suspect or untrustworthy, examine the belief that wellbeing requires vigilance to sustain.",
    },
    satisfied: {
        key: "satisfied",
        name: "Satisfied",
        quadrant: "low-pleasant",
        valence: "pleasant",
        arousal: "low",
        emoji: "✅",
        keywords: ["completion", "standard-met", "retrospective", "accomplished", "closure"],
        definition:
            "Task or work concluded at or above standard. Inherently retrospective. Brief — capture before it fades.",
        somaticHints: [
            "Brief warmth in chest on finishing",
            "Small exhale, held tension releases",
            "Body opens — lean back, shoulders drop",
        ],
        quickAction:
            "Write one sentence: what completed and what made it sufficient. Closes the loop and records output.",
        healingNote:
            'Satisfaction immediately dismissed ("it\'s done, but…") is the signature of perfectionism as protection. How fast does it get replaced?',
    },
    reflective: {
        key: "reflective",
        name: "Reflective",
        quadrant: "low-pleasant",
        valence: "pleasant",
        arousal: "low",
        emoji: "🤔",
        keywords: ["introspection", "retrospective", "review", "lesson-extraction", "meaning-making"],
        definition:
            "Attention turned inward or backward. Generative without being activating. Optimal for retrospectives and identity-level insight.",
        somaticHints: [
            "Gaze upward or to the side",
            "Quieter slower breathing",
            "Inward focused face — present but not outward",
        ],
        quickAction:
            "Write without editing. Let the insight arrive in the third sentence — first two are throat-clearing.",
        healingNote:
            "Reflective time without a journaling habit dissipates without yielding insight. Capture matters; the act of writing produces the thought.",
    },
    peaceful: {
        key: "peaceful",
        name: "Peaceful",
        quadrant: "low-pleasant",
        valence: "pleasant",
        arousal: "low",
        emoji: "☮️",
        keywords: ["deep-rest", "internal-quiet", "no-conflict", "spacious", "settled-positive"],
        definition:
            "Internal conflict has quieted. Deeper than calm — calm is regulated; peaceful is the absence of even subtle disturbance.",
        somaticHints: ["A felt internal silence", "Body fully at rest without holding", "No mental commentary running"],
        quickAction: "Allow it. Don't fill it immediately with tasks — peaceful is rare and worth not interrupting.",
        healingNote:
            "Peaceful states often emerge after a difficult thing has been resolved or accepted. Note what preceded each peaceful entry — that's the pattern.",
    },
    grateful: {
        key: "grateful",
        name: "Grateful",
        quadrant: "low-pleasant",
        valence: "pleasant",
        arousal: "low",
        emoji: "🙏",
        keywords: ["appreciation", "received", "specific-good", "interconnection", "noticing"],
        definition:
            'A specific good has been received and is being noticed. Best kept specific — "grateful for [thing]" not "grateful in general."',
        somaticHints: ["Warmth, expansion in chest", "Soft wide eyes", "Slight smile at rest"],
        quickAction:
            'Name one specific thing — not a category. "I\'m grateful that X happened" is more nourishing than "I\'m grateful for my life."',
        healingNote:
            "Gratitude practice that feels forced often is. Specific in-the-moment noticing produces the felt state; abstract gratitude lists rarely do.",
    },
    relaxed: {
        key: "relaxed",
        name: "Relaxed",
        quadrant: "low-pleasant",
        valence: "pleasant",
        arousal: "low",
        emoji: "😎",
        keywords: ["physical-ease", "low-effort", "muscles-released", "post-recovery", "gentle"],
        definition: "Body is not holding. The somatic complement to calm — physical, not just regulated.",
        somaticHints: ["Muscles long, hands open", "Easy unhurried breath", "Movements gentle, no rush"],
        quickAction:
            "Note the conditions that produced this state. Reproducibility is the value — what was the ratio of work to recovery?",
        healingNote:
            "Relaxed that requires substances (alcohol, sedatives) to access points at a structural problem, not a personal one.",
    },
    hopeful: {
        key: "hopeful",
        name: "Hopeful",
        quadrant: "low-pleasant",
        valence: "pleasant",
        arousal: "low",
        emoji: "✨",
        keywords: ["future-positive", "trust", "possibility-felt", "patient", "anticipating-good"],
        definition:
            "A positive future feels possible. Quieter than excited — patience is part of it. Trust without certainty.",
        somaticHints: [
            "Soft chest expansion at the thought of the future",
            "Slight uplift in posture",
            "Eyes look forward and up briefly",
        ],
        quickAction:
            "Name the specific future state you're hopeful about. Vague hope is less actionable than specific hope.",
        healingNote:
            'Hopeful immediately followed by self-correction ("but probably not") is a learned pattern. Notice the move and let the hope finish first.',
    },
    "at-ease": {
        key: "at-ease",
        name: "At Ease",
        quadrant: "low-pleasant",
        valence: "pleasant",
        arousal: "low",
        emoji: "😊",
        keywords: ["social-comfort", "no-performance", "natural", "unguarded", "present-with-others"],
        definition: "Comfortable in current context — no performance required. The relational complement to calm.",
        somaticHints: ["Easy posture, natural movement", "Eyes meet others without effort", "Speech without rehearsal"],
        quickAction:
            "Use this for relational work — feedback conversations, collaboration, repair. At-ease is the state in which others receive you well.",
        healingNote:
            "If at-ease is rare in social contexts, examine which relationships and settings consistently produce it. That data is a values map.",
    },
    present: {
        key: "present",
        name: "Present",
        quadrant: "low-pleasant",
        valence: "pleasant",
        arousal: "low",
        emoji: "🧘",
        keywords: ["here-now", "sensory", "attention-immediate", "non-conceptual", "witnessing"],
        definition:
            "Attention fully on what is happening, here, now. Distraction, rumination, anticipation are temporarily quiet.",
        somaticHints: [
            "Rich vivid sensory perception",
            "Body feels inhabited",
            "Genuine eye contact with objects, people",
        ],
        quickAction:
            "Don't move yet. Take one slow breath, look at something for five seconds with full attention, then let the task return.",
        healingNote:
            "Present as a mood entry (not a practice) tells you the proportion of time spent in actual experience vs. retrospection or anticipation.",
    },
};

// ---------------------------------------------------------------------------
// QUADRANT METADATA — for the by-feeling picker
// ---------------------------------------------------------------------------

export interface QuadrantMeta {
    key: Quadrant;
    name: string;
    /** Short axis label, e.g. "Activated · Pleasant". */
    axisLabel: string;
    description: string;
}

export const QUADRANTS: QuadrantMeta[] = [
    {
        key: "high-pleasant",
        name: "Activated · Pleasant",
        axisLabel: "↗︎",
        description: "Sympathetic activation, welcomed. Best for creative, challenging, generative work.",
    },
    {
        key: "high-unpleasant",
        name: "Activated · Unpleasant",
        axisLabel: "↖︎",
        description: "Sympathetic activation, threatening. Body mobilizing for demand exceeding capacity.",
    },
    {
        key: "low-pleasant",
        name: "Calm · Pleasant",
        axisLabel: "↘︎",
        description: "Parasympathetic with positive valence. Recovery, integration, deep cognitive work.",
    },
    {
        key: "low-unpleasant",
        name: "Calm · Unpleasant",
        axisLabel: "↙︎",
        description: "Parasympathetic shutdown. Pushing harder is usually the wrong prescription here.",
    },
];

// ---------------------------------------------------------------------------
// SOMATIC SIGNAL INDEX — body-first lookup
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// LOOKUP HELPERS
// ---------------------------------------------------------------------------

export function getMood(key: string | null | undefined): MoodEntry | null {
    if (!key) return null;
    return MOODS[key] ?? null;
}

export function moodsInQuadrant(quadrant: Quadrant): MoodEntry[] {
    return Object.values(MOODS)
        .filter((m) => m.quadrant === quadrant)
        .sort((a, b) => a.name.localeCompare(b.name));
}
