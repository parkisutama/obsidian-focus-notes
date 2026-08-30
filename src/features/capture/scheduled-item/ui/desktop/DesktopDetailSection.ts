import { type App, Setting } from "obsidian";
import { FileSuggest, FolderSuggest } from "../../../../../infrastructure/obsidian/suggestions/Suggesters.ts";
import type { ScheduledItemFormData } from "../../domain/ScheduledItemFormData.ts";

interface DesktopDetailSectionOptions {
    app: App;
    data: ScheduledItemFormData;
    defaultDetailNotesFolder?: string;
    update(change: () => void): void;
    changedAndRender(): void;
}

export function renderDesktopDetailSection(container: HTMLElement, options: DesktopDetailSectionOptions): void {
    const data = options.data;
    new Setting(container).setName("Detail Note").addDropdown((dropdown) =>
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
                options.changedAndRender();
            }),
    );
    if (data.detailNote.mode === "link") {
        const setting = new Setting(container).setName("Existing note").setClass("fn-scheduled-item-form-wide-field");
        const input = setting.controlEl.createEl("input", {
            type: "text",
            attr: { "aria-label": "Existing Detail Note" },
        });
        input.value = data.detailNote.path;
        input.addEventListener("input", () =>
            options.update(() => {
                if (data.detailNote.mode === "link") data.detailNote.path = input.value;
            }),
        );
        new FileSuggest(options.app, input);
    }
    if (data.detailNote.mode !== "create") return;
    new Setting(container)
        .setName("Note name")
        .setClass("fn-scheduled-item-form-wide-field")
        .addText((text) =>
            text.setValue(data.detailNote.mode === "create" ? data.detailNote.name : "").onChange((value) =>
                options.update(() => {
                    if (data.detailNote.mode === "create") data.detailNote.name = value;
                }),
            ),
        );
    const setting = new Setting(container).setName("Folder").setClass("fn-scheduled-item-form-wide-field");
    const input = setting.controlEl.createEl("input", {
        type: "text",
        attr: { "aria-label": "Detail Note folder" },
    });
    input.value = data.detailNote.folder;
    input.addEventListener("input", () =>
        options.update(() => {
            if (data.detailNote.mode === "create") data.detailNote.folder = input.value;
        }),
    );
    new FolderSuggest(options.app, input);
}
