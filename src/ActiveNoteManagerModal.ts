import { type App, Modal, setIcon } from "obsidian";
import { activeNoteItemMeta, buildActiveNoteManagerModel } from "./ActiveNoteManagerModel";
import type { ScheduledItem, ScheduledItemKind } from "./ScheduledItemTypes";

export class ActiveNoteManagerModal extends Modal {
    constructor(
        app: App,
        private fileName: string,
        private items: ScheduledItem[],
        private onAdd: (kind: ScheduledItemKind) => void,
        private onEdit: (item: ScheduledItem) => void,
    ) {
        super(app);
    }

    onOpen(): void {
        const model = buildActiveNoteManagerModel(this.fileName, this.items);
        this.modalEl.addClass("fn-active-note-manager-modal");
        this.contentEl.empty();

        const header = this.contentEl.createDiv({ cls: "fn-active-note-manager-header" });
        header.createEl("h2", { text: model.title });
        header.createDiv({ cls: "fn-active-note-manager-subtitle", text: model.subtitle });
        const actions = this.contentEl.createDiv({ cls: "fn-active-note-manager-actions" });
        this.renderAddButton(actions, "calendar-plus", "Add Event", "event");
        this.renderAddButton(actions, "list-plus", "Add Task", "task");

        if (model.groups.length === 0) {
            this.contentEl.createDiv({ cls: "fn-active-note-manager-empty", text: model.emptyMessage });
            return;
        }

        const list = this.contentEl.createDiv({ cls: "fn-active-note-manager-list" });
        for (const group of model.groups) {
            const section = list.createDiv({ cls: "fn-active-note-manager-group" });
            section.createDiv({ cls: "fn-active-note-manager-group-title", text: group.heading });
            for (const item of group.items) {
                const row = section.createEl("button", { cls: "fn-active-note-manager-row" });
                const icon = row.createSpan({ cls: "fn-active-note-manager-kind", attr: { "aria-hidden": "true" } });
                setIcon(icon, item.kind === "event" ? "calendar" : item.isCompleted ? "circle-check" : "circle");
                const body = row.createSpan({ cls: "fn-active-note-manager-body" });
                body.createSpan({ cls: "fn-active-note-manager-name", text: item.title });
                body.createSpan({ cls: "fn-active-note-manager-meta", text: activeNoteItemMeta(item) });
                row.addEventListener("click", () => {
                    this.close();
                    this.onEdit(item);
                });
            }
        }
    }

    onClose(): void {
        this.contentEl.empty();
    }

    private renderAddButton(parent: HTMLElement, iconName: string, label: string, kind: ScheduledItemKind): void {
        const button = parent.createEl("button", { text: label });
        const icon = createSpan({ attr: { "aria-hidden": "true" } });
        setIcon(icon, iconName);
        button.prepend(icon);
        button.addEventListener("click", () => {
            this.close();
            this.onAdd(kind);
        });
    }
}
