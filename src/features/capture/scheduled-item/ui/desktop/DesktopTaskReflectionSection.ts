import type { App } from "obsidian";
import { ContextNotesController } from "../../../moment/ui/InboxNotesController.ts";
import type { ContextSourceSettings } from "../../../../object-notes/domain/ContextSourceSettings.ts";
import { EmotionalWellbeingPicker } from "../../../../reflection/ui/EmotionalWellbeingPicker.ts";
import type { ScheduledItemFormData } from "../../domain/ScheduledItemFormData.ts";

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

    const wellbeingSection = container.createDiv({ cls: "focus-notes-modal-section" });
    wellbeingSection.createDiv({ cls: "focus-notes-modal-label", text: "Emotional Wellbeing" });
    wellbeingSection.createDiv({
        cls: "focus-notes-modal-desc",
        text: "Optional — how did working on this Task feel? Add or update any time.",
    });
    new EmotionalWellbeingPicker(
        wellbeingSection,
        (value) =>
            options.update(() => {
                data.stressLevel = value.stressLevel;
                data.emotionCategory = value.emotionCategory;
                data.emotionKey = value.emotionKey;
            }),
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
