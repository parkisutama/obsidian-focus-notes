import { type App, FuzzySuggestModal, Modal, Notice, Setting, type TFile } from "obsidian";
import type { DisplayMode, EmotionCategory, FocusTarget, StressLevel } from "./types";
import { EmotionalWellbeingPicker } from "./EmotionalWellbeingPicker";
import { FileSuggest } from "./Suggesters";
import { isTFile } from "./utils";
import { ReflectionFocusModal } from "./ReflectionFocusModal";

export interface LogModalResult {
    task: string;
    notes: string;
    stressLevel: StressLevel | null;
    emotionCategory: EmotionCategory | null;
    moodKey: string | null;
    /** Comma-or-space-separated wikilinks. Stored as the user typed it. */
    links: string;
}

export interface LogModalContext {
    mode: DisplayMode;
    startTime: Date;
    endTime: Date;
    durationSeconds: number;
    initialTask: string;
    resolvedTarget: FocusTarget;
}

/**
 * Log modal with four input groups, top-to-bottom:
 *
 *   1. What are you doing      — single line, FileSuggest. If the user picks
 *                                a file, the value becomes [[FileName]] so it
 *                                renders as a link in the bullet.
 *   2. Emotional Wellbeing     — stress level + simple emotion category/state.
 *   3. Reflection and notes    — single textarea. The "head/heart/hand" prompt
 *                                lives in the placeholder as a reminder, not as
 *                                separate fields, so day-to-day logging stays
 *                                fast.
 *   4. Related links           — text input with a "+ Add note" button that
 *                                opens a fuzzy file picker; chosen files
 *                                append [[Name]] to the field. Free-form
 *                                editing also works.
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
    private links = "";
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
        // because the Setting layout puts the textarea in a 20%-wide column
        // alongside the description — too cramped for actual reflective
        // writing. Same shape as the Wellbeing and Related-links sections below.
        const reflectionSection = contentEl.createDiv({ cls: "focus-notes-modal-section" });
        const reflectionHead = reflectionSection.createDiv({ cls: "fn-reflection-head" });
        reflectionHead.createDiv({
            cls: "focus-notes-modal-label",
            text: "Reflection and notes",
        });
        // "Open expanded" button — opens ReflectionFocusModal with wellbeing
        // reminder + CBT guidance for users who want the scaffolding while
        // writing. The inline textarea below is preserved so quick logging
        // stays one click away.
        const expandBtn = reflectionHead.createEl("button", {
            cls: "fn-reflection-expand",
            text: "Open expanded ↗",
        });
        reflectionSection.createDiv({
            cls: "focus-notes-modal-desc",
            text:
                "Anything — task progress, ideas, blockers, or what affected your wellbeing. " +
                "Open expanded for CBT prompts and a thought-record view.",
        });
        const reflectionTextarea = reflectionSection.createEl("textarea", {
            cls: "fn-reflection-inline-textarea",
            attr: {
                placeholder: "What happened? What shifted your stress or emotion? What did you produce?",
            },
        });
        reflectionTextarea.rows = 6;
        reflectionTextarea.addEventListener("input", () => {
            this.notes = reflectionTextarea.value;
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
                (result) => {
                    if (result !== null) {
                        this.notes = result;
                        reflectionTextarea.value = result;
                    }
                },
            ).open();
        });

        // ---- 4. Related links ----------------------------------------------
        const linksSection = contentEl.createDiv({ cls: "focus-notes-modal-section" });
        linksSection.createEl("div", {
            cls: "focus-notes-modal-label",
            text: "Related links",
        });
        linksSection.createEl("div", {
            cls: "focus-notes-modal-desc",
            text: "Notes you referenced or want to remember next session.",
        });
        const linksRow = linksSection.createDiv({ cls: "focus-notes-links-row" });
        const linksInput = linksRow.createEl("input", {
            type: "text",
            cls: "focus-notes-links-input",
            attr: {
                placeholder: "[[Project X]] [[Performance notes]] — type or click + to pick",
            },
        });
        linksInput.addEventListener("input", () => (this.links = linksInput.value));
        const addBtn = linksRow.createEl("button", {
            cls: "focus-notes-links-add",
            text: "+ Add note",
        });
        addBtn.addEventListener("click", (evt) => {
            // Prevent the default form-submit behavior of <button> inside a modal.
            evt.preventDefault();
            new FilePickerSuggester(this.app, (file) => {
                const stem = file.basename;
                const link = `[[${stem}]]`;
                const trimmed = linksInput.value.trim();
                linksInput.value = trimmed ? `${trimmed} ${link}` : link;
                this.links = linksInput.value;
            }).open();
        });

        // ---- Action buttons ------------------------------------------------
        const buttons = contentEl.createDiv({ cls: "focus-notes-modal-buttons" });
        const discard = buttons.createEl("button", { text: "Discard" });
        discard.addEventListener("click", () => this.cancel());
        const save = buttons.createEl("button", { text: "Save", cls: "mod-cta" });
        save.addEventListener("click", () => this.submit());
    }

    onClose(): void {
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
            links: this.links,
        });
        this.close();
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

/**
 * Tiny fuzzy file picker for the "+ Add note" button. Uses Obsidian's native
 * FuzzySuggestModal so it feels identical to the link-completer in the editor.
 */
class FilePickerSuggester extends FuzzySuggestModal<TFile> {
    constructor(
        app: App,
        private onPick: (file: TFile) => void,
    ) {
        super(app);
        this.setPlaceholder("Pick a note to link…");
    }

    getItems(): TFile[] {
        return this.app.vault
            .getMarkdownFiles()
            .filter(isTFile)
            .sort((a, b) => a.path.localeCompare(b.path));
    }

    getItemText(file: TFile): string {
        return file.path;
    }

    onChooseItem(file: TFile): void {
        this.onPick(file);
    }
}

/**
 * No-op reference to silence linters when Notice isn't used directly here yet.
 * If we add inline validation later (e.g. "you typed a non-existent link"),
 * Notice is the right surface.
 */
void Notice;
