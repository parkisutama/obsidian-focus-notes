import { type App, Modal } from "obsidian";
import { getMood } from "./MoodReference";
import { CBT_PROMPTS, COGNITIVE_DISTORTIONS } from "./CognitiveDistortions";
import type { EmotionCategory, StressLevel } from "./types";
import { getEmotionCategoryLabel, getStressLevelLabel } from "./EmotionalWellbeingReference";

export interface ReflectionWellbeingContext {
    stressLevel: StressLevel | null;
    emotionCategory: EmotionCategory | null;
    emotionKey: string | null;
}

/**
 * Expanded reflection modal — opened from the main LogModal when the user
 * clicks "Open expanded".
 *
 * Layout, top to bottom:
 *   1. Emotional Wellbeing card — the stress level and emotion context the
 *      user selected in the parent log modal.
 *   2. Big textarea — the actual writing space. ~14 rows by default.
 *   3. Collapsible "CBT prompts" — six questions as scaffolding, written
 *      as bullets the user reads. NOT form fields. The user writes all
 *      their answers in the single textarea above; this panel is reference.
 *   4. Collapsible "Cognitive distortions" — ten patterns the user can
 *      scan to identify their automatic thought. Each row has a short
 *      example quote and a one-line description.
 *
 * The contract with the parent LogModal:
 *   - Constructor takes the current notes and the selected wellbeing context.
 *   - onClose passes the (possibly edited) notes back to the parent.
 *   - Cancel returns the original notes unchanged. Save commits.
 *
 * Why a separate modal (not an inline expand within LogModal):
 *   - Real estate. The CBT guidance is reference material that needs room
 *     to breathe; squeezing it into a sidebar-shaped modal would either
 *     hide it (bad) or push the buttons below the fold (worse).
 *   - Focus. Opening a fresh modal signals "you're now in writing mode".
 *     The user's reflection is the only active task in this layer.
 *   - Cancel-safety. The parent modal's other fields (mood, links) keep
 *     their values regardless of what happens here.
 */
export class ReflectionFocusModal extends Modal {
    private currentText: string;
    private resolved = false;

    constructor(
        app: App,
        private initialText: string,
        private wellbeing: ReflectionWellbeingContext,
        private onResolve: (text: string | null) => void,
    ) {
        super(app);
        this.currentText = initialText;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("focus-notes-reflection-modal");

        contentEl.createEl("h2", { text: "Reflection" });

        // ---- 1. Emotional Wellbeing reminder card -----------------------
        const mood = getMood(this.wellbeing.emotionKey);
        const stressLabel = getStressLevelLabel(this.wellbeing.stressLevel);
        const emotionCategoryLabel = getEmotionCategoryLabel(this.wellbeing.emotionCategory);
        if (stressLabel || emotionCategoryLabel || mood) {
            const reminder = contentEl.createDiv({ cls: "fn-reflection-mood-card" });
            const header = reminder.createDiv({ cls: "fn-reflection-mood-head" });
            header.createSpan({ cls: "fn-reflection-mood-emoji", text: mood?.emoji ?? " " });
            const headText = header.createDiv({ cls: "fn-reflection-mood-title" });
            headText.createDiv({ cls: "fn-reflection-mood-name", text: "Emotional Wellbeing" });
            if (stressLabel) {
                headText.createDiv({
                    cls: "fn-reflection-mood-quadrant",
                    text: `Stress: ${stressLabel}`,
                });
            }
            if (mood) {
                reminder.createDiv({
                    cls: "fn-reflection-mood-def",
                    text: `Emotion: ${mood.name}${emotionCategoryLabel ? ` (${emotionCategoryLabel})` : ""}`,
                });
            } else if (emotionCategoryLabel) {
                reminder.createDiv({
                    cls: "fn-reflection-mood-def",
                    text: `Emotion: ${emotionCategoryLabel}`,
                });
            }
        }

        // ---- 2. Big textarea --------------------------------------------
        const writeSection = contentEl.createDiv({ cls: "fn-reflection-write" });
        writeSection.createDiv({
            cls: "fn-reflection-write-label",
            text: "Write freely. The prompts below are guidance — answer in any order, skip what doesn't fit.",
        });
        const textarea = writeSection.createEl("textarea", {
            cls: "fn-reflection-textarea",
            attr: {
                placeholder:
                    "What happened, what shifted your stress or emotion, " +
                    "and what would be a kinder and more accurate description...",
            },
        });
        textarea.value = this.initialText;
        textarea.rows = 14;
        textarea.addEventListener("input", () => {
            this.currentText = textarea.value;
        });
        // Auto-focus so the user can start typing immediately.
        window.setTimeout(() => textarea.focus(), 60);

        // ---- 3. Collapsible CBT prompts panel ---------------------------
        // <details> is the simplest collapsible primitive — native, accessible,
        // keyboard-toggleable, scroll-friendly. No state machine to maintain.
        //
        // Default-open policy: CBT-style restructuring is most useful for
        // unpleasant states (anxious, frustrated, defensive…) where there's
        // a thought worth examining. Pleasant states (in-flow, content,
        // grateful) usually don't benefit from cognitive challenge — opening
        // the panel by default there would feel like the modal is asking the
        // user to fix something that isn't broken. Same logic for the
        // distortions panel below.
        const defaultOpen = this.wellbeing.emotionCategory === "unpleasant";

        const promptsDetails = contentEl.createEl("details", {
            cls: "fn-reflection-collapsible",
        });
        if (defaultOpen) promptsDetails.setAttr("open", "");
        promptsDetails.createEl("summary", {
            cls: "fn-reflection-collapsible-summary",
            text: "Mini-CBT prompts (optional reference)",
        });
        const promptsBody = promptsDetails.createDiv({
            cls: "fn-reflection-collapsible-body",
        });
        const promptsList = promptsBody.createEl("ol", { cls: "fn-cbt-prompts" });
        for (const prompt of CBT_PROMPTS) {
            const li = promptsList.createEl("li", { cls: "fn-cbt-prompt-item" });
            const head = li.createDiv({ cls: "fn-cbt-prompt-head" });
            head.createSpan({ cls: "fn-cbt-prompt-label", text: prompt.label });
            head.createSpan({ cls: "fn-cbt-prompt-question", text: prompt.question });
            if (prompt.hint) {
                li.createDiv({ cls: "fn-cbt-prompt-hint", text: prompt.hint });
            }
        }

        // ---- 4. Collapsible cognitive distortions panel -----------------
        const distortionsDetails = contentEl.createEl("details", {
            cls: "fn-reflection-collapsible",
        });
        if (defaultOpen) distortionsDetails.setAttr("open", "");
        distortionsDetails.createEl("summary", {
            cls: "fn-reflection-collapsible-summary",
            text: "Cognitive distortions to check against",
        });
        const distortionsBody = distortionsDetails.createDiv({
            cls: "fn-reflection-collapsible-body",
        });
        distortionsBody.createDiv({
            cls: "fn-distortions-intro",
            text:
                "Scan the patterns below for anything that resembles your automatic thought. " +
                "Naming the pattern reduces its grip. Multiple patterns can apply at once.",
        });
        const distortionsList = distortionsBody.createDiv({ cls: "fn-distortions-list" });
        for (const d of COGNITIVE_DISTORTIONS) {
            const row = distortionsList.createDiv({ cls: "fn-distortion-row" });
            row.createDiv({ cls: "fn-distortion-name", text: d.name });
            row.createDiv({ cls: "fn-distortion-example", text: d.example });
            row.createDiv({ cls: "fn-distortion-desc", text: d.description });
        }

        // ---- Action buttons ---------------------------------------------
        const buttons = contentEl.createDiv({ cls: "focus-notes-modal-buttons" });
        const cancel = buttons.createEl("button", { text: "Cancel" });
        cancel.addEventListener("click", () => this.cancel());
        const save = buttons.createEl("button", { text: "Save reflection", cls: "mod-cta" });
        save.addEventListener("click", () => this.save());
    }

    onClose(): void {
        this.contentEl.empty();
        // If the modal was dismissed without an explicit save/cancel (Esc,
        // overlay click), treat that as cancel — preserve the original text.
        if (!this.resolved) {
            this.resolved = true;
            this.onResolve(null);
        }
    }

    private cancel(): void {
        if (this.resolved) return;
        this.resolved = true;
        this.onResolve(null);
        this.close();
    }

    private save(): void {
        if (this.resolved) return;
        this.resolved = true;
        this.onResolve(this.currentText);
        this.close();
    }
}
