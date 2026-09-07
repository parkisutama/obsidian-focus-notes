import { type App, Modal } from "obsidian";
import { getMood } from "../domain/MoodReference";
import { CBT_PROMPTS, COGNITIVE_DISTORTIONS } from "../domain/CognitiveDistortions";
import { getEmotionCategoryLabel, getStressLevelLabel } from "../domain/EmotionalWellbeingReference";
import type { EmotionCategory, StressLevel } from "../domain/Wellbeing";
import { ContextNotesController } from "../../capture/moment/ui/InboxNotesController";
import type { ContextSourceSettings } from "../../object-notes/domain/ContextSourceSettings";

export interface ReflectionWellbeingContext {
    stressLevel: StressLevel | null;
    emotionCategory: EmotionCategory | null;
    emotionKey: string | null;
}

/** What the rich @ mention editor needs to resolve/scope its Object Note suggestions. */
export interface ReflectionEditorContext {
    targetFile: string;
    getContextSources: () => ContextSourceSettings[];
}

/**
 * Expanded reflection modal — opened from LogModal or FocusSessionEditModal when the user
 * clicks "Open expanded".
 *
 * Layout, top to bottom:
 *   1. Emotional Wellbeing card — the stress level and emotion context the
 *      user selected in the parent modal.
 *   2. Big rich editor (ContextNotesController) — the actual writing space,
 *      supporting the same @ mention linking to Object Notes/Tasks/Events as
 *      the Description field on Event/Task.
 *   3. Collapsible "CBT prompts" — six questions as scaffolding, written
 *      as bullets the user reads. NOT form fields. The user writes all
 *      their answers in the single editor above; this panel is reference.
 *   4. Collapsible "Cognitive distortions" — ten patterns the user can
 *      scan to identify their automatic thought. Each row has a short
 *      example quote and a one-line description.
 *
 * The contract with the parent modal:
 *   - Constructor takes the current notes, the selected wellbeing context, and the editor
 *     context (target file + Object Source scoping) needed to resolve @ mention suggestions.
 *   - onClose passes the (possibly edited) notes back to the parent.
 *   - Cancel returns the original notes unchanged. Save commits.
 *
 * Why a separate modal (not an inline expand within the parent):
 *   - Real estate. The CBT guidance is reference material that needs room
 *     to breathe; squeezing it into a sidebar-shaped modal would either
 *     hide it (bad) or push the buttons below the fold (worse).
 *   - Focus. Opening a fresh modal signals "you're now in writing mode".
 *     The user's reflection is the only active task in this layer.
 *   - Cancel-safety. The parent modal's other fields (mood) keep their
 *     values regardless of what happens here.
 */
export class ReflectionFocusModal extends Modal {
    private currentText: string;
    private resolved = false;
    private notesController: ContextNotesController | null = null;

    constructor(
        app: App,
        private initialText: string,
        private wellbeing: ReflectionWellbeingContext,
        private editorContext: ReflectionEditorContext,
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
            const reminder = contentEl.createDiv({ cls: "fn-reflection-wellbeing-context" });
            reminder.createSpan({ cls: "fn-reflection-wellbeing-label", text: "Wellbeing" });
            reminder.createSpan({
                cls: "fn-reflection-wellbeing-value",
                text: [
                    stressLabel ? `Stress ${stressLabel}` : "",
                    mood
                        ? `${mood.emoji} ${mood.name}${emotionCategoryLabel ? ` · ${emotionCategoryLabel}` : ""}`
                        : emotionCategoryLabel,
                ]
                    .filter(Boolean)
                    .join(" · "),
            });
        }

        // ---- 2. Big rich editor -------------------------------------------
        const writeSection = contentEl.createDiv({ cls: "fn-reflection-write" });
        writeSection.createDiv({
            cls: "fn-reflection-write-label",
            text:
                "Write freely. Type @ to link an Object Note, Task, or Event. The prompts below are " +
                "guidance — answer in any order, skip what doesn't fit.",
        });
        const editorEl = writeSection.createDiv({
            cls: "fn-gcal-desc-input fn-reflection-textarea",
            attr: {
                role: "textbox",
                "aria-label": "Reflection",
                "aria-multiline": "true",
                "data-placeholder":
                    "What happened, what shifted your stress or emotion, " +
                    "and what would be a kinder and more accurate description...",
            },
        });
        this.notesController = new ContextNotesController(this.app, editorEl, {
            initialValue: this.initialText,
            targetFile: this.editorContext.targetFile,
            getContextSources: this.editorContext.getContextSources,
            referenceFormat: "markdown-link",
            onChange: (value) => {
                this.currentText = value;
            },
        });
        // Auto-focus so the user can start typing immediately.
        window.setTimeout(() => editorEl.focus(), 60);

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
        this.notesController?.destroy();
        this.notesController = null;
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
