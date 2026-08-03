import { type App, Modal, Notice, Setting, type TFile } from "obsidian";
import { createObjectNote, getCreatableObjectSources } from "./ObjectNote";
import type { ContextSourceSettings } from "./types";

export class ObjectNoteModal extends Modal {
    private readonly sources: ContextSourceSettings[];
    private sourceId = "";
    private folder = "";
    private name: string;
    private folderSelect: HTMLSelectElement | null = null;

    constructor(
        app: App,
        sources: readonly ContextSourceSettings[],
        initialName: string,
        private readonly onCreated: (file: TFile, label: string) => void,
    ) {
        super(app);
        this.sources = getCreatableObjectSources(sources);
        this.sourceId = this.sources[0]?.id ?? "";
        this.folder = this.sources[0]?.folders[0] ?? "";
        this.name = initialName.trim();
    }

    onOpen(): void {
        this.setTitle("Create Object Note");
        this.modalEl.addClass("fn-object-note-modal");
        new Setting(this.contentEl).setName("Object type").addDropdown((dropdown) => {
            for (const source of this.sources) dropdown.addOption(source.id, source.name);
            dropdown.setValue(this.sourceId).onChange((value) => {
                this.sourceId = value;
                this.folder = this.currentSource()?.folders[0] ?? "";
                this.renderFolderOptions();
            });
        });
        new Setting(this.contentEl).setName("Name").addText((text) => {
            text.setPlaceholder("New object")
                .setValue(this.name)
                .onChange((value) => (this.name = value));
            window.setTimeout(() => text.inputEl.focus());
        });
        new Setting(this.contentEl).setName("Folder").addDropdown((dropdown) => {
            this.folderSelect = dropdown.selectEl;
            dropdown.onChange((value) => (this.folder = value));
            this.renderFolderOptions();
        });
        const actions = this.contentEl.createDiv({ cls: "fn-object-note-actions" });
        actions.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
        actions
            .createEl("button", { text: "Create", cls: "mod-cta" })
            .addEventListener("click", () => void this.submit());
    }

    onClose(): void {
        this.contentEl.empty();
    }

    private currentSource(): ContextSourceSettings | null {
        return this.sources.find((source) => source.id === this.sourceId) ?? null;
    }

    private renderFolderOptions(): void {
        if (!this.folderSelect) return;
        this.folderSelect.empty();
        for (const folder of this.currentSource()?.folders ?? []) {
            this.folderSelect.createEl("option", { value: folder, text: folder || "Vault root" });
        }
        this.folderSelect.value = this.folder;
    }

    private async submit(): Promise<void> {
        const source = this.currentSource();
        const name = this.name.trim();
        if (!source || !name) {
            new Notice("Choose an Object Type and enter a name.");
            return;
        }
        try {
            const file = await createObjectNote(this.app, source, { name, folder: this.folder });
            this.onCreated(file, name);
            this.close();
        } catch (error) {
            new Notice(error instanceof Error ? error.message : "Could not create Object Note.");
        }
    }
}
