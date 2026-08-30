import { type App, Setting } from "obsidian";
import { ObjectNoteSuggest } from "../../../../object-notes/ui/ObjectNoteSuggest.ts";
import { FileSuggest, FolderSuggest } from "../../../../../infrastructure/obsidian/suggestions/Suggesters.ts";
import type { ContextSourceSettings } from "../../../../object-notes/domain/ContextSourceSettings.ts";
import type { InsertPosition } from "../../../../../shared/markdown/InsertPosition.ts";
import type { ScheduledItemFormData } from "../../domain/ScheduledItemFormData.ts";
import type { MobileFormFields } from "./MobileFormFields.ts";

export interface MobileScheduledItemCreateContext {
    targetFile: string;
    targetHeading: string;
    targetPosition: InsertPosition;
    /** Event only: once true, Planned Start changes stop recalculating targetFile. */
    targetManuallyEdited: boolean;
}

interface MobileSectionOptions {
    app: App;
    data: ScheduledItemFormData;
    fields: MobileFormFields;
    registerSuggester(suggester: { close(): void }): void;
}

export function renderMobileDetailSection(
    body: HTMLElement,
    options: MobileSectionOptions & { defaultDetailNotesFolder?: string; rerender(): void },
): void {
    const data = options.data;
    new Setting(body).setName("Detail Note").addDropdown((dropdown) =>
        dropdown
            .addOptions({ none: "None", link: "Link existing", create: "Create new" })
            .setValue(data.detailNote.mode)
            .onChange((mode) => {
                data.detailNote =
                    mode === "link"
                        ? { mode: "link", path: "" }
                        : mode === "create"
                          ? { mode: "create", name: data.title, folder: options.defaultDetailNotesFolder ?? "" }
                          : { mode: "none" };
                options.rerender();
            }),
    );
    if (data.detailNote.mode === "link") {
        const input = options.fields.text(body, "Detail Note path", data.detailNote.path, (value) => {
            if (data.detailNote.mode === "link") data.detailNote.path = value;
        });
        options.registerSuggester(new FileSuggest(options.app, input));
    }
    if (data.detailNote.mode !== "create") return;
    options.fields.text(body, "Detail Note name", data.detailNote.name, (value) => {
        if (data.detailNote.mode === "create") data.detailNote.name = value;
    });
    const folder = options.fields.text(body, "Detail Note folder", data.detailNote.folder, (value) => {
        if (data.detailNote.mode === "create") data.detailNote.folder = value;
    });
    options.registerSuggester(new FolderSuggest(options.app, folder));
}

export function renderMobileTargetSection(
    body: HTMLElement,
    options: MobileSectionOptions & {
        context: MobileScheduledItemCreateContext;
        getAllowedTaskSources(): ContextSourceSettings[];
        onTargetFileChange(value: string): void;
    },
): void {
    const file = options.fields.text(body, "Save to file", options.context.targetFile, (value) => {
        options.context.targetFile = value;
        options.context.targetManuallyEdited = true;
        options.onTargetFileChange(value);
    });
    if (options.data.kind === "task") {
        options.registerSuggester(new ObjectNoteSuggest(options.app, file, options.getAllowedTaskSources));
    } else {
        options.registerSuggester(new FileSuggest(options.app, file));
    }
    options.fields.text(body, "Save under heading", options.context.targetHeading, (value) => {
        options.context.targetHeading = value;
    });
    options.fields.toggle(body, "Insert at top", options.context.targetPosition === "start", (value) => {
        options.context.targetPosition = value ? "start" : "end";
    });
}
