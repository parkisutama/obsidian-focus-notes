import { type App, Setting } from "obsidian";
import type { ContextSourceSettings } from "../../../../object-notes/domain/ContextSourceSettings.ts";
import {
    getEmotionCategoryLabel,
    getStressLevelLabel,
} from "../../../../reflection/domain/EmotionalWellbeingReference.ts";
import { getMood } from "../../../../reflection/domain/MoodReference.ts";
import { EmotionalWellbeingPicker } from "../../../../reflection/ui/EmotionalWellbeingPicker.ts";
import { ContextNotesController } from "../../../moment/ui/InboxNotesController.ts";
import type { ScheduledItemFormData } from "../../domain/ScheduledItemFormData.ts";

export function renderMobileReflectionSection(
    container: HTMLElement,
    options: {
        app: App;
        data: ScheduledItemFormData;
        targetFile: string;
        getContextSources(): ContextSourceSettings[];
        update(change: () => void): void;
    },
): ContextNotesController {
    const wellbeing = container.createEl("details", {
        cls: "focus-notes-modal-section fn-wellbeing-disclosure",
    });
    wellbeing.open = false;
    const summary = wellbeing.createEl("summary", { cls: "fn-wellbeing-disclosure-summary" });
    summary.createSpan({ cls: "focus-notes-modal-label", text: "Emotional Wellbeing" });
    const summaryValue = summary.createSpan({
        cls: "fn-wellbeing-disclosure-value",
        text: summarizeWellbeing(options.data),
    });
    const wellbeingBody = wellbeing.createDiv({ cls: "fn-wellbeing-disclosure-body" });
    new EmotionalWellbeingPicker(
        wellbeingBody,
        (value) => {
            options.update(() => Object.assign(options.data, value));
            summaryValue.setText(summarizeWellbeing(options.data));
        },
        {
            stressLevel: options.data.stressLevel,
            emotionCategory: options.data.emotionCategory,
            emotionKey: options.data.emotionKey,
        },
    );
    const notes = new Setting(container)
        .setName("Reflection notes")
        .setDesc("What happened or should change next time?");
    const editor = notes.controlEl.createDiv({
        cls: "fn-mobile-event-description",
        attr: { role: "textbox", "aria-label": "Reflection notes", "aria-multiline": "true" },
    });
    return new ContextNotesController(options.app, editor, {
        initialValue: options.data.reflectionNotes ?? "",
        targetFile: options.targetFile,
        getContextSources: options.getContextSources,
        referenceFormat: "markdown-link",
        onChange: (value) => options.update(() => (options.data.reflectionNotes = value)),
    });
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
