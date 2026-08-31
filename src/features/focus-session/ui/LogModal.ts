import { type App, Modal, Setting } from "obsidian";
import type { DisplayMode } from "../domain/Timer";
import type { EmotionCategory, StressLevel } from "../../reflection/domain/Wellbeing";
import type { FocusTarget } from "../../capture/domain/CaptureTarget";
import { EmotionalWellbeingPicker } from "../../reflection/ui/EmotionalWellbeingPicker";
import { FileSuggest } from "../../../infrastructure/obsidian/suggestions/Suggesters";
import { ContextNotesController } from "../../capture/moment/ui/InboxNotesController";
import type { ContextSourceSettings } from "../../object-notes/domain/ContextSourceSettings";
import { ReflectionFocusModal } from "../../reflection/ui/ReflectionFocusModal";

export interface LogModalResult {
    task: string;
    /** May contain inline [[links]]/[links](...) the user typed via @ mention — see ContextNotesController. */
    notes: string;
    stressLevel: StressLevel | null;
    emotionCategory: EmotionCategory | null;
    moodKey: string | null;
}

export interface LogModalContext {
    mode: DisplayMode;
    startTime: Date;
    endTime: Date;
    durationSeconds: number;
    initialTask: string;
    resolvedTarget: FocusTarget;
    getContextSources: () => ContextSourceSettings[];
}

/**
 * Log modal with three input groups, top-to-bottom:
 *
 *   1. What are you doing      — single line, FileSuggest. If the user picks
 *                                a file, the value becomes [[FileName]] so it
 *                                renders as a link in the bullet.
 *   2. Emotional Wellbeing     — stress level + simple emotion category/state.
 *   3. Reflection and notes    — ContextNotesController (the same rich
 *                                contenteditable Event/Task's Description field
 *                                uses): type @ to link an Object Note, Task, or
 *                                Event inline, alongside free-text reflection.
 *                                No separate "Related links" field — a link
 *                                relevant to the session belongs in the
 *                                reflection itself, not a second place to fill in.
 *
 * Result delivery contract: onSubmit fires exactly once with either the
 * filled record or null (Discard / Esc / overlay close).
 */
export class LogModal extends Modal {
    private task: string;
    private notes = "";
    private stressLevel: StressLevel | null = null;
    private emotionCategory: EmotionCategory | null = null;
    private moodKey: string | null = null;
    private notesController: ContextNotesController | null = null;
    private notesEditorEl: HTMLDivElement | null = null;
    private resolved = false;

    constructor(
        app: App,
        private context: LogModalContext,
        private onSubmit: (result: LogModalResult | null) => void,
    ) {
        super(app);
        this.task = context.initialTask;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("focus-notes-modal");
        // Larger modal — the picker grid needs the room.
        contentEl.addClass("focus-notes-modal-wide");

        contentEl.createEl("h2", { text: "Log session" });

        // Compact summary strip — duration + target preview.
        const summary = contentEl.createDiv({ cls: "focus-notes-modal-summary" });
        summary.createEl("div", { text: this.summarizeContext() });
        const targetLine = summary.createEl("div", { cls: "focus-notes-modal-target" });
        targetLine.setText(this.summarizeTarget());

        // ---- 1. What are you doing -----------------------------------------
        new Setting(contentEl)
            .setName("What are you doing?")
            .setDesc("Free text or a [[note link]]. Pick from the suggester to link.")
            .addText((text) => {
                text.setPlaceholder("e.g. Read chapter 3, Meditate, Refactor pipeline")
                    .setValue(this.task)
                    .onChange((value) => (this.task = value));
                // FileSuggest dispatches "input" not "change" when the user picks
                // from the dropdown — this listener catches both keystrokes and
                // suggester selections.
                text.inputEl.addEventListener("input", () => {
                    // If the suggester just dropped a path in, wrap it as a link.
                    // Cheap heuristic: looks like a path, no spaces, ends with .md.
                    const value = text.inputEl.value;
                    if (/^[^\s[]+\.md$/.test(value)) {
                        const stem = value.replace(/\.md$/, "");
                        text.inputEl.value = `[[${stem}]]`;
                        this.task = text.inputEl.value;
                    } else {
                        this.task = value;
                    }
                });
                new FileSuggest(this.app, text.inputEl);
                window.setTimeout(() => {
                    text.inputEl.focus();
                    text.inputEl.select();
                }, 50);
                text.inputEl.addEventListener("keydown", (evt) => {
                    if (evt.key === "Enter" && !evt.shiftKey) {
                        evt.preventDefault();
                        this.submit();
                    }
                });
            });

        // ---- 2. Emotional Wellbeing ---------------------------------------
        const wellbeingSection = contentEl.createDiv({ cls: "focus-notes-modal-section" });
        wellbeingSection.createEl("div", {
            cls: "focus-notes-modal-label",
            text: "Emotional Wellbeing",
        });
        wellbeingSection.createEl("div", {
            cls: "focus-notes-modal-desc",
            text: "Keep it light: choose stress level, then Unpleasant, Neutral, or Pleasant.",
        });
        new EmotionalWellbeingPicker(wellbeingSection, (value) => {
            this.stressLevel = value.stressLevel;
            this.emotionCategory = value.emotionCategory;
            this.moodKey = value.emotionKey;
        });

        // ---- 3. Reflection and notes ---------------------------------------
        // Rendered as a full-width section (not an Obsidian Setting row),
        // because the Setting layout puts the editor in a 20%-wide column
        // alongside the description — too cramped for actual reflective
        // writing. Same shape as the Wellbeing section above.
        const reflectionSection = contentEl.createDiv({ cls: "focus-notes-modal-section" });
        const reflectionHead = reflectionSection.createDiv({ cls: "fn-reflection-head" });
        reflectionHead.createDiv({
            cls: "focus-notes-modal-label",
            text: "Reflection and notes",
        });
        // "Open expanded" button — opens ReflectionFocusModal with wellbeing
        // reminder + CBT guidance for users who want the scaffolding while
        // writing. The inline editor below is preserved so quick logging
        // stays one click away.
        const expandBtn = reflectionHead.createEl("button", {
            cls: "fn-reflection-expand",
            text: "Open expanded ↗",
        });
        reflectionSection.createDiv({
            cls: "focus-notes-modal-desc",
            text:
                "Anything — task progress, ideas, blockers, or what affected your wellbeing. Type @ to " +
                "link an Object Note, Task, or Event. Open expanded for CBT prompts and a thought-record view.",
        });
        this.notesEditorEl = reflectionSection.createDiv({
            cls: "fn-gcal-desc-input fn-reflection-inline-editor",
            attr: {
                role: "textbox",
                "aria-label": "Reflection and notes",
                "aria-multiline": "true",
                "data-placeholder": "What happened? What shifted your stress or emotion? What did you produce?",
            },
        });
        this.notesController = new ContextNotesController(this.app, this.notesEditorEl, {
            initialValue: this.notes,
            targetFile: this.context.resolvedTarget.file,
            getContextSources: this.context.getContextSources,
            referenceFormat: "markdown-link",
            onChange: (value) => {
                this.notes = value;
            },
        });
        expandBtn.addEventListener("click", (evt) => {
            evt.preventDefault();
            new ReflectionFocusModal(
                this.app,
                this.notes,
                {
                    stressLevel: this.stressLevel,
                    emotionCategory: this.emotionCategory,
                    emotionKey: this.moodKey,
                },
                {
                    targetFile: this.context.resolvedTarget.file,
                    getContextSources: this.context.getContextSources,
                },
                (result) => {
                    if (result !== null) this.replaceNotesContent(result);
                },
            ).open();
        });

        // ---- Action buttons ------------------------------------------------
        const buttons = contentEl.createDiv({ cls: "focus-notes-modal-buttons" });
        const discard = buttons.createEl("button", { text: "Discard" });
        discard.addEventListener("click", () => this.cancel());
        const save = buttons.createEl("button", { text: "Save", cls: "mod-cta" });
        save.addEventListener("click", () => this.submit());
    }

    onClose(): void {
        this.notesController?.destroy();
        this.notesController = null;
        this.notesEditorEl = null;
        this.contentEl.empty();
        if (!this.resolved) {
            this.resolved = true;
            this.onSubmit(null);
        }
    }

    private cancel(): void {
        if (this.resolved) return;
        this.resolved = true;
        this.onSubmit(null);
        this.close();
    }

    private submit(): void {
        if (this.resolved) return;
        this.resolved = true;
        this.onSubmit({
            task: this.task,
            notes: this.notes,
            stressLevel: this.stressLevel,
            emotionCategory: this.emotionCategory,
            moodKey: this.moodKey,
        });
        this.close();
    }

    /**
     * ContextNotesController has no public "replace the whole value" API (only the private
     * constructor-time renderInitialValue does the markdown→rich-DOM parse), so ReflectionFocusModal's
     * returned text is applied by tearing down and rebuilding the controller against the same
     * container element rather than trying to diff/patch its contenteditable DOM by hand.
     */
    private replaceNotesContent(value: string): void {
        this.notes = value;
        const container = this.notesEditorEl;
        if (!container) return;
        this.notesController?.destroy();
        container.empty();
        this.notesController = new ContextNotesController(this.app, container, {
            initialValue: value,
            targetFile: this.context.resolvedTarget.file,
            getContextSources: this.context.getContextSources,
            referenceFormat: "markdown-link",
            onChange: (next) => {
                this.notes = next;
            },
        });
    }

    private summarizeContext(): string {
        const fmt = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const m = Math.floor(this.context.durationSeconds / 60);
        const s = this.context.durationSeconds % 60;
        const dur = m > 0 ? `${m}m ${s}s` : `${s}s`;
        const label =
            this.context.mode === "stopwatch" ? "Stopwatch" : this.context.mode === "pomodoro" ? "Pomodoro" : "Timer";
        return `${label} • ${fmt(this.context.startTime)} → ${fmt(this.context.endTime)} • ${dur}`;
    }

    private summarizeTarget(): string {
        const t = this.context.resolvedTarget;
        const heading = t.heading ? ` › ${t.heading}` : "";
        const pos = t.position === "start" ? "top" : "bottom";
        return `→ ${t.file}${heading} (${pos})`;
    }
}
