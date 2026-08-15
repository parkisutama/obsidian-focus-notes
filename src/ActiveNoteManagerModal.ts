import { type App, Modal, setIcon } from "obsidian";
import type { ActiveNoteChecklistScopes } from "./ActiveNoteLedger";
import {
    type ActiveNoteManagerScopeOption,
    activeNoteItemMeta,
    buildActiveNoteManagerModel,
    buildActiveNoteManagerScopeOptions,
} from "./ActiveNoteManagerModel";
import type { ScheduledItem, ScheduledItemKind } from "./ScheduledItemTypes";
import { inspectTaskLine, taskLineLintLabel } from "./TaskLineLint";

export class ActiveNoteManagerModal extends Modal {
    constructor(
        app: App,
        private fileName: string,
        ledgerItems: ScheduledItem[],
        checklistScopes: ActiveNoteChecklistScopes,
        private onAdd: (kind: ScheduledItemKind) => void,
        private onEdit: (item: ScheduledItem) => void,
    ) {
        super(app);
        this.scopes = buildActiveNoteManagerScopeOptions(ledgerItems, checklistScopes);
    }

    private scopes: ActiveNoteManagerScopeOption[];
    private selectedScopeId = "ledger";

    onOpen(): void {
        this.modalEl.addClass("fn-active-note-manager-modal");
        this.contentEl.empty();

        const header = this.contentEl.createDiv({ cls: "fn-active-note-manager-header" });
        header.createEl("h2", { text: "Tasks & events" });
        header.createDiv({ cls: "fn-active-note-manager-subtitle", text: this.fileName });
        const actions = this.contentEl.createDiv({ cls: "fn-active-note-manager-actions" });
        this.renderAddButton(actions, "calendar-plus", "Add Event", "event");
        this.renderAddButton(actions, "list-plus", "Add Task", "task");

        const scopeRow = this.contentEl.createDiv({ cls: "fn-active-note-manager-scope" });
        scopeRow.createEl("label", { text: "Show", attr: { for: "fn-active-note-manager-scope-select" } });
        const select = scopeRow.createEl("select", {
            attr: { id: "fn-active-note-manager-scope-select", "aria-label": "Task and Event scope" },
        });
        for (const scope of this.scopes) {
            select.createEl("option", { value: scope.id, text: `${scope.label} (${scope.items.length})` });
        }
        select.value = this.selectedScopeId;
        const results = this.contentEl.createDiv();
        select.addEventListener("change", () => {
            this.selectedScopeId = select.value;
            this.renderResults(results);
        });
        this.renderResults(results);
    }

    private renderResults(container: HTMLElement): void {
        container.empty();
        const scope = this.scopes.find((candidate) => candidate.id === this.selectedScopeId) ?? this.scopes[0];
        const model = buildActiveNoteManagerModel(this.fileName, scope?.items ?? []);
        if (model.groups.length === 0) {
            container.createDiv({
                cls: "fn-active-note-manager-empty",
                text: model.emptyMessage,
                attr: { role: "status" },
            });
            return;
        }

        const list = container.createDiv({ cls: "fn-active-note-manager-list" });
        for (const group of model.groups) {
            const section = list.createDiv({ cls: "fn-active-note-manager-group" });
            section.createDiv({ cls: "fn-active-note-manager-group-title", text: group.heading });
            for (const item of group.items) {
                const row = section.createEl("button", { cls: "fn-active-note-manager-row" });
                const icon = row.createSpan({ cls: "fn-active-note-manager-kind", attr: { "aria-hidden": "true" } });
                setIcon(icon, item.kind === "event" ? "calendar" : item.isCompleted ? "circle-check" : "circle");
                const body = row.createSpan({ cls: "fn-active-note-manager-body" });
                const titleRow = body.createSpan({ cls: "fn-active-note-manager-title-row" });
                titleRow.createSpan({ cls: "fn-active-note-manager-name", text: item.title });
                if (item.kind === "task") {
                    const lint = inspectTaskLine(item.rawLine);
                    titleRow.createSpan({
                        cls: `fn-active-note-manager-lint fn-active-note-manager-lint-${lint.status}`,
                        text: taskLineLintLabel(lint.status),
                    });
                }
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
