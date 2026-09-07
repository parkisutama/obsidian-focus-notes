import type { App } from "obsidian";
import { ContextNotesController } from "../../../moment/ui/InboxNotesController.ts";
import type { ContextSourceSettings } from "../../../../object-notes/domain/ContextSourceSettings.ts";
import { EmotionalWellbeingPicker } from "../../../../reflection/ui/EmotionalWellbeingPicker.ts";
import type { ScheduledItemFormData } from "../../domain/ScheduledItemFormData.ts";
import { getMood } from "../../../../reflection/domain/MoodReference.ts";
import {
    getEmotionCategoryLabel,
    getStressLevelLabel,
} from "../../../../reflection/domain/EmotionalWellbeingReference.ts";

export interface DesktopTaskReflectionSectionOptions {
    app: App;
    data: ScheduledItemFormData;
    targetFile: string;
    getContextSources(): ContextSourceSettings[];
    update(change: () => void): void;
}

/**
 * Edit mode, Task only: mood/reflection is never set at creation — it's optional, addable or
 * correctable any time via Edit Task. Wellbeing reuses the same EmotionalWellbeingPicker
 * component Focus Session's LogModal/Edit Session already use, writing the same `stress:`/
 * `emotion:`/`mood:` token names onto the Task's own line (see TaskLineEditor.ts). Reflection
 * notes is a genuinely separate field from Description — one is what the Task is about, this is
 * a retrospective on how it went — stored as its own `- notes: ...` child line (see
 * ScheduledItemBlockEditor.ts) and edited through the same @ mention ContextNotesController the
 * Description field uses, not folded into it.
 *
 * Returns the notes field's ContextNotesController so the caller can destroy it on
 * re-render/teardown, same lifecycle contract as the shell's own descriptionController.
 */
export function renderDesktopReflectionSection(
    container: HTMLElement,
    options: DesktopTaskReflectionSectionOptions,
): ContextNotesController {
    const { data } = options;

    const wellbeingSection = container.createEl("details", {
        cls: "focus-notes-modal-section fn-wellbeing-disclosure",
    });
    if (!hasWellbeing(data)) wellbeingSection.setAttr("open", "");
    const summary = wellbeingSection.createEl("summary", { cls: "fn-wellbeing-disclosure-summary" });
    summary.createSpan({ cls: "focus-notes-modal-label", text: "Emotional Wellbeing" });
    const summaryValue = summary.createSpan({
        cls: "fn-wellbeing-disclosure-value",
        text: summarizeWellbeing(data),
    });
    const wellbeingBody = wellbeingSection.createDiv({ cls: "fn-wellbeing-disclosure-body" });
    wellbeingBody.createDiv({
        cls: "focus-notes-modal-desc",
        text: "Optional — how did working on this Task feel?",
    });
    new EmotionalWellbeingPicker(
        wellbeingBody,
        (value) => {
            options.update(() => {
                data.stressLevel = value.stressLevel;
                data.emotionCategory = value.emotionCategory;
                data.emotionKey = value.emotionKey;
            });
            summaryValue.setText(summarizeWellbeing(data));
        },
        { stressLevel: data.stressLevel, emotionCategory: data.emotionCategory, emotionKey: data.emotionKey },
    );

    const notesSection = container.createDiv({ cls: "focus-notes-modal-section" });
    notesSection.createDiv({ cls: "focus-notes-modal-label", text: "Reflection notes" });
    notesSection.createDiv({
        cls: "focus-notes-modal-desc",
        text: "How did it go? Type @ to link an Object Note, Task, or Event.",
    });
    const editor = notesSection.createDiv({
        cls: "fn-gcal-desc-input",
        attr: {
            role: "textbox",
            "aria-label": "Reflection notes",
            "aria-multiline": "true",
            "data-placeholder": "What happened, what would you do differently next time...",
        },
    });
    return new ContextNotesController(options.app, editor, {
        initialValue: data.reflectionNotes ?? "",
        targetFile: options.targetFile,
        getContextSources: options.getContextSources,
        referenceFormat: "markdown-link",
        onChange: (value) => options.update(() => (data.reflectionNotes = value)),
    });
}

function hasWellbeing(data: ScheduledItemFormData): boolean {
    return Boolean(data.stressLevel || data.emotionCategory || data.emotionKey);
}

function summarizeWellbeing(data: ScheduledItemFormData): string {
    const stress = getStressLevelLabel(data.stressLevel);
    const emotion = getEmotionCategoryLabel(data.emotionCategory);
    const mood = getMood(data.emotionKey);
    if (!stress && !emotion && !mood) return "Not set";
    return [
        stress ? `Stress ${stress}` : "",
        emotion ? `Emotion ${emotion}` : "",
        mood ? `Mood ${mood.emoji} ${mood.name}` : "",
    ]
        .filter(Boolean)
        .join(" · ");
}
