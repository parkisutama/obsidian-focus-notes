import { type App, setIcon } from "obsidian";
import { FileSuggest } from "../../../../../infrastructure/obsidian/suggestions/Suggesters";
import type { InsertPosition } from "../../../../../shared/markdown/InsertPosition";
import {
    getEmotionCategoryLabel,
    getStressLevelLabel,
} from "../../../../reflection/domain/EmotionalWellbeingReference.ts";
import { getMood } from "../../../../reflection/domain/MoodReference.ts";
import { EmotionalWellbeingPicker } from "../../../../reflection/ui/EmotionalWellbeingPicker.ts";
import type { FocusNotesSettings } from "../../../../settings/domain/FocusNotesSettings";
import type { FocusTarget } from "../../../domain/CaptureTarget";
import type { EventTaskFormState } from "../../../domain/EventTaskFormState";
import { InboxNotesController } from "../InboxNotesController";

interface InboxMobileFormOptions {
    app: App;
    form: EventTaskFormState;
    getSettings(): FocusNotesSettings;
    resolveTarget(): FocusTarget | null;
    targetSummaryEl: HTMLElement;
    registerCleanup(cleanup: () => void): void;
}

/** Compact Inbox fields for the independent mobile full-screen editor. */
export class InboxMobileForm {
    private notesController: InboxNotesController | null = null;
    private reflectionNotesController: InboxNotesController | null = null;
    private targetSummaryEl: HTMLElement | null = null;

    constructor(private readonly options: InboxMobileFormOptions) {}

    render(container: HTMLElement): void {
        this.targetSummaryEl = this.options.targetSummaryEl;
        this.refreshTarget(false);

        const notes = container.createDiv({ cls: "fn-mobile-moment-section fn-mobile-moment-notes-section" });
        notes.createDiv({ cls: "fn-mobile-event-label", text: "Notes" });
        const notesEl = notes.createDiv({
            cls: "fn-mobile-inbox-notes fn-mobile-moment-primary-editor",
            attr: {
                "aria-label": "Moment notes",
                "data-placeholder": "Add context. Use @ for contextual notes, # for tags.",
            },
        });
        this.notesController = new InboxNotesController(this.options.app, notesEl, {
            initialValue: this.options.form.inboxBody,
            targetFile: this.options.resolveTarget()?.file ?? "",
            getContextSources: () => this.options.getSettings().inbox.contextSources,
            onChange: (value) => (this.options.form.inboxBody = value),
        });
        this.options.registerCleanup(() => this.destroy());

        this.renderReflection(container);

        const advanced = container.createEl("details", { cls: "fn-mobile-event-disclosure fn-mobile-inbox-advanced" });
        const summary = advanced.createEl("summary", { cls: "fn-mobile-event-summary" });
        const icon = summary.createSpan({ cls: "fn-mobile-event-summary-icon" });
        setIcon(icon, "sliders-horizontal");
        const text = summary.createSpan({ cls: "fn-mobile-event-summary-text" });
        text.createSpan({ text: "More options" });
        text.createEl("small", { text: "Save location and suggestion sources" });
        const chevron = summary.createSpan({ cls: "fn-mobile-event-summary-chevron" });
        setIcon(chevron, "chevron-down");
        this.renderAdvanced(advanced.createDiv({ cls: "fn-mobile-event-disclosure-content" }));
    }

    destroy(): void {
        this.notesController?.destroy();
        this.notesController = null;
        this.reflectionNotesController?.destroy();
        this.reflectionNotesController = null;
        this.targetSummaryEl = null;
    }

    private renderReflection(container: HTMLElement): void {
        const section = container.createDiv({ cls: "fn-mobile-moment-reflection" });
        const wellbeing = section.createEl("details", {
            cls: "focus-notes-modal-section fn-wellbeing-disclosure",
        });
        wellbeing.open = false;
        const summary = wellbeing.createEl("summary", { cls: "fn-wellbeing-disclosure-summary" });
        summary.createSpan({ cls: "focus-notes-modal-label", text: "Emotional Wellbeing" });
        const summaryValue = summary.createSpan({
            cls: "fn-wellbeing-disclosure-value",
            text: this.summarizeWellbeing(),
        });
        const wellbeingBody = wellbeing.createDiv({ cls: "fn-wellbeing-disclosure-body" });
        new EmotionalWellbeingPicker(
            wellbeingBody,
            (value) => {
                this.options.form.inboxStressLevel = value.stressLevel;
                this.options.form.inboxEmotionCategory = value.emotionCategory;
                this.options.form.inboxEmotionKey = value.emotionKey;
                summaryValue.setText(this.summarizeWellbeing());
            },
            {
                stressLevel: this.options.form.inboxStressLevel,
                emotionCategory: this.options.form.inboxEmotionCategory,
                emotionKey: this.options.form.inboxEmotionKey,
            },
        );
        const notesLabel = section.createDiv({ cls: "fn-mobile-moment-reflection-label" });
        notesLabel.createDiv({ cls: "fn-mobile-event-label", text: "Reflection notes" });
        notesLabel.createEl("small", { text: "What stood out?" });
        const editor = section.createDiv({
            cls: "fn-mobile-inbox-notes fn-mobile-moment-reflection-editor",
            attr: { role: "textbox", "aria-label": "Moment reflection notes" },
        });
        this.reflectionNotesController = new InboxNotesController(this.options.app, editor, {
            initialValue: this.options.form.inboxReflectionNotes ?? "",
            targetFile: this.options.resolveTarget()?.file ?? "",
            getContextSources: () => this.options.getSettings().inbox.contextSources,
            onChange: (value) => (this.options.form.inboxReflectionNotes = value),
        });
    }

    private renderAdvanced(container: HTMLElement): void {
        const title = this.textField(container, "clock-3", "Moment title", "Timestamp or custom title");
        title.value = this.options.form.inboxTitle;
        title.addEventListener("input", () => (this.options.form.inboxTitle = title.value));

        const file = this.textField(container, "file-text", "Save to", "Note path");
        file.value = this.options.form.inboxTargetFile;
        file.addEventListener("input", () => {
            this.options.form.inboxTargetFile = file.value;
            this.refreshTarget();
        });
        const fileSuggest = new FileSuggest(this.options.app, file);
        this.options.registerCleanup(() => fileSuggest.close());

        const heading = this.textField(container, "hash", "Heading", "Moment");
        heading.value = this.options.form.inboxHeading;
        heading.addEventListener("input", () => {
            this.options.form.inboxHeading = heading.value;
            this.refreshTarget(false);
        });

        const position = this.selectField(
            container,
            "list-end",
            "Insert position",
            [
                { value: "end", label: "End of section" },
                { value: "start", label: "Start of section" },
            ],
            this.options.form.inboxPosition,
        );
        position.addEventListener("change", () => {
            this.options.form.inboxPosition = position.value as InsertPosition;
        });
    }

    private fieldRow(container: HTMLElement, icon: string, label: string): HTMLElement {
        const row = container.createDiv({ cls: "fn-mobile-event-field-row" });
        const iconEl = row.createSpan({ cls: "fn-mobile-event-field-icon" });
        setIcon(iconEl, icon);
        const content = row.createDiv({ cls: "fn-mobile-event-field-content" });
        content.createDiv({ cls: "fn-mobile-event-label", text: label });
        return content;
    }

    private textField(container: HTMLElement, icon: string, label: string, placeholder: string): HTMLInputElement {
        const content = this.fieldRow(container, icon, label);
        return content.createEl("input", {
            type: "text",
            cls: "fn-mobile-event-input",
            attr: { "aria-label": label, placeholder },
        });
    }

    private selectField(
        container: HTMLElement,
        icon: string,
        label: string,
        options: Array<{ value: string; label: string }>,
        initial: string,
    ): HTMLSelectElement {
        const content = this.fieldRow(container, icon, label);
        const select = content.createEl("select", {
            cls: "fn-mobile-event-input",
            attr: { "aria-label": label },
        });
        for (const option of options) select.createEl("option", { value: option.value, text: option.label });
        select.value = initial;
        return select;
    }

    private refreshTarget(updateNotes = true): void {
        const target = this.options.resolveTarget();
        this.targetSummaryEl?.setText(
            target ? `${target.file} · ${target.heading || "No heading"}` : "Selected destination is unavailable",
        );
        if (updateNotes && target) {
            this.notesController?.setTargetFile(target.file);
            this.reflectionNotesController?.setTargetFile(target.file);
        }
    }

    private summarizeWellbeing(): string {
        const stress = getStressLevelLabel(this.options.form.inboxStressLevel);
        const emotion = getEmotionCategoryLabel(this.options.form.inboxEmotionCategory);
        const mood = getMood(this.options.form.inboxEmotionKey);
        if (!stress && !emotion && !mood) return "Not set";
        return [
            stress ? `Stress ${stress}` : "",
            emotion ? `Emotion ${emotion}` : "",
            mood ? `Mood ${mood.emoji} ${mood.name}` : "",
        ]
            .filter(Boolean)
            .join(" · ");
    }
}
