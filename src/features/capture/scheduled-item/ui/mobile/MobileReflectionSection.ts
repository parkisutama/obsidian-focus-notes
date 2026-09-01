import { type App, Setting } from "obsidian";
import { ContextNotesController } from "../../../moment/ui/InboxNotesController.ts";
import type { ScheduledItemFormData } from "../../domain/ScheduledItemFormData.ts";
import type { ContextSourceSettings } from "../../../../object-notes/domain/ContextSourceSettings.ts";
import { EmotionalWellbeingPicker } from "../../../../reflection/ui/EmotionalWellbeingPicker.ts";

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
    const wellbeing = new Setting(container).setName("Emotional Wellbeing").setDesc("Optional Reflection context.");
    new EmotionalWellbeingPicker(
        wellbeing.controlEl,
        (value) => options.update(() => Object.assign(options.data, value)),
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
