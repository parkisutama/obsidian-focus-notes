import { type App, Setting } from "obsidian";
import { ObjectNoteSuggest } from "../../../../object-notes/ui/ObjectNoteSuggest.ts";
import { FileSuggest } from "../../../../../infrastructure/obsidian/suggestions/Suggesters.ts";
import type { InsertPosition } from "../../../../../shared/markdown/InsertPosition.ts";
import type { ContextSourceSettings } from "../../../../object-notes/domain/ContextSourceSettings.ts";
import type { ScheduledItemFormData } from "../../domain/ScheduledItemFormData.ts";

export interface DesktopScheduledItemCreateContext {
    targetFile: string;
    targetHeading: string;
    targetPosition: InsertPosition;
    /** Event only: once true, Planned Start changes stop recalculating targetFile. */
    targetManuallyEdited: boolean;
}

interface DesktopCreateTargetSectionOptions {
    app: App;
    data: ScheduledItemFormData;
    context: DesktopScheduledItemCreateContext;
    getAllowedTaskSources(): ContextSourceSettings[];
    onTargetFileChange(value: string): void;
}

export function renderDesktopCreateTargetSection(
    container: HTMLElement,
    options: DesktopCreateTargetSectionOptions,
): void {
    const fileSetting = new Setting(container).setName("Save to file");
    const file = fileSetting.controlEl.createEl("input", {
        type: "text",
        attr: { "aria-label": "Save to file", placeholder: "Daily/2026-08-28.md" },
    });
    file.value = options.context.targetFile;
    file.addEventListener("input", () => {
        options.context.targetFile = file.value;
        options.context.targetManuallyEdited = true;
        options.onTargetFileChange(file.value);
    });
    if (options.data.kind === "task") {
        new ObjectNoteSuggest(options.app, file, options.getAllowedTaskSources);
    } else {
        new FileSuggest(options.app, file);
    }
    new Setting(container).setName("Heading").addText((text) =>
        text.setValue(options.context.targetHeading).onChange((value) => {
            options.context.targetHeading = value;
        }),
    );
    new Setting(container).setName("Insert at top").addToggle((toggle) =>
        toggle.setValue(options.context.targetPosition === "start").onChange((enabled) => {
            options.context.targetPosition = enabled ? "start" : "end";
        }),
    );
}
