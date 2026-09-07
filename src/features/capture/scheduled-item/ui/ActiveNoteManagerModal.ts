import { type App, Modal, setIcon } from "obsidian";
import type { ActiveNoteChecklistScopes } from "../application/ActiveNoteLedger";
import {
    type ActiveNoteManagerScopeOption,
    activeNoteItemMeta,
    buildActiveNoteManagerModel,
    buildActiveNoteManagerScopeOptions,
} from "../application/ActiveNoteManagerModel";
import type { ScheduledItem, ScheduledItemKind } from "../domain/ScheduledItem";
import { TaskFormatPreviewModal } from "./TaskFormatPreviewModal";
import { createScheduledItemBlockId } from "../domain/ScheduledItemBlockId.ts";
import { buildScheduledItemIdentityChange } from "../domain/ScheduledItemIdentityMigration.ts";
import type { TaskFormatChange } from "../domain/TaskFormatWriter";
import { inspectTaskLine, taskLineLintLabel } from "../domain/TaskLineLint.ts";
import { captureLedgerRecord } from "../domain/LedgerRecordSource.ts";
import {
    planScheduledItemBlockFormat,
    type ScheduledItemBlockFormatChange,
} from "../domain/ScheduledItemBlockFormat.ts";
import { isTFile } from "../../../../infrastructure/obsidian/vault/ObsidianFileTypes.ts";

export class ActiveNoteManagerModal extends Modal {
    constructor(
        app: App,
        private fileName: string,
        private filePath: string,
        ledgerItems: ScheduledItem[],
        checklistScopes: ActiveNoteChecklistScopes,
        private onAdd: (kind: ScheduledItemKind) => void,
        private onEdit: (item: ScheduledItem) => void,
        private onFormatComplete: () => void,
    ) {
        super(app);
        this.scopes = buildActiveNoteManagerScopeOptions(ledgerItems, checklistScopes);
    }

    private scopes: ActiveNoteManagerScopeOption[];
    private selectedScopeId = "ledger";
    private pendingBlockIds = new Map<string, string>();

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
        const formatButton = scopeRow.createEl("button", { text: "Format" });
        for (const scope of this.scopes) {
            select.createEl("option", { value: scope.id, text: `${scope.label} (${scope.items.length})` });
        }
        select.value = this.selectedScopeId;
        const results = this.contentEl.createDiv();
        select.addEventListener("change", () => {
            this.selectedScopeId = select.value;
            this.renderResults(results);
            void this.syncFormatButton(formatButton);
        });
        formatButton.addEventListener("click", () => void this.openFormatPreview());
        void this.syncFormatButton(formatButton);
        this.renderResults(results);
    }

    /**
     * Items still missing a stable block ID get one here, single-line and independent of block
     * canonicalization: `blockFormatChanges` (Task 60) requires an existing block ID to resolve
     * the item, so identity always lands first, and a later Format run canonicalizes the rest.
     */
    private lineFormatChanges(): TaskFormatChange[] {
        const scope = this.scopes.find((candidate) => candidate.id === this.selectedScopeId) ?? this.scopes[0];
        return (scope?.items ?? []).flatMap((item) => {
            if (item.referenceTarget) return [];
            if (item.blockId) return [];
            let blockId = this.pendingBlockIds.get(item.id);
            if (!blockId) {
                blockId = createScheduledItemBlockId(item.kind);
                this.pendingBlockIds.set(item.id, blockId);
            }
            const identityChange = buildScheduledItemIdentityChange(item, blockId);
            return identityChange ? [identityChange] : [];
        });
    }

    /**
     * Task 60: canonicalizes every already-identified Task/Event block — keyed prefixes, canonical
     * child order, and a Task Focus Session nested under its Timebox promoted to a direct sibling —
     * through the same `planScheduledItemBlockFormat` the block editor's own writes converge to.
     */
    private blockFormatChanges(content: string): ScheduledItemBlockFormatChange[] {
        const scope = this.scopes.find((candidate) => candidate.id === this.selectedScopeId) ?? this.scopes[0];
        return (scope?.items ?? []).flatMap((item) => {
            if (item.referenceTarget) return [];
            if (!item.blockId) return [];
            const captured = captureLedgerRecord(content, {
                filePath: this.filePath,
                lineNumber: item.source.lineNumber,
                rawLine: item.rawLine,
            });
            if (captured.status !== "captured") return [];
            const plan = planScheduledItemBlockFormat(captured.snapshot.rawBlock);
            if (plan.status !== "needs-format") return [];
            return [
                { lineNumber: item.source.lineNumber, rawLine: item.rawLine, normalizedBlock: plan.normalizedBlock },
            ];
        });
    }

    private async readFileContent(): Promise<string | null> {
        const file = this.app.vault.getAbstractFileByPath(this.filePath);
        if (!isTFile(file)) return null;
        return this.app.vault.read(file);
    }

    private async syncFormatButton(button: HTMLButtonElement): Promise<void> {
        const content = await this.readFileContent();
        const count = this.lineFormatChanges().length + (content ? this.blockFormatChanges(content).length : 0);
        button.disabled = count === 0;
        button.setText(count > 0 ? `Format ${count}` : "Format");
    }

    private async openFormatPreview(): Promise<void> {
        const content = await this.readFileContent();
        const lineChanges = this.lineFormatChanges();
        const blockChanges = content ? this.blockFormatChanges(content) : [];
        if (lineChanges.length === 0 && blockChanges.length === 0) return;
        this.close();
        new TaskFormatPreviewModal(this.app, this.filePath, lineChanges, blockChanges, this.onFormatComplete).open();
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
                if (item.referenceTarget) {
                    titleRow.createSpan({
                        cls: "fn-active-note-manager-lint fn-active-note-manager-lint-reference",
                        text: "Reference",
                    });
                } else if (item.kind === "task") {
                    const lint = inspectTaskLine(item.rawLine);
                    titleRow.createSpan({
                        cls: `fn-active-note-manager-lint fn-active-note-manager-lint-${lint.status}`,
                        text: item.blockId ? taskLineLintLabel(lint.status) : "Missing block ID",
                    });
                } else if (!item.blockId) {
                    titleRow.createSpan({
                        cls: "fn-active-note-manager-lint fn-active-note-manager-lint-needs-format",
                        text: "Missing block ID",
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
