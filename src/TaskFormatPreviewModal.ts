import { type App, Modal, Notice } from "obsidian";
import { saveTaskFormatChanges, type TaskFormatChange } from "./TaskFormatWriter";

export class TaskFormatPreviewModal extends Modal {
    private saving = false;

    constructor(
        app: App,
        private filePath: string,
        private changes: TaskFormatChange[],
        private onComplete: () => void,
    ) {
        super(app);
    }

    onOpen(): void {
        this.modalEl.addClass("fn-task-format-preview-modal");
        this.contentEl.empty();
        this.contentEl.createEl("h2", {
            text: `Format ${this.changes.length} task${this.changes.length === 1 ? "" : "s"}`,
        });
        this.contentEl.createDiv({
            cls: "fn-task-format-preview-subtitle",
            text: "Review every change before updating the note.",
        });

        const list = this.contentEl.createDiv({ cls: "fn-task-format-preview-list" });
        for (const change of this.changes) {
            const entry = list.createDiv({ cls: "fn-task-format-preview-entry" });
            entry.createDiv({ cls: "fn-task-format-preview-line", text: `Line ${change.lineNumber}` });
            this.renderCode(entry, "Before", change.rawLine);
            this.renderCode(entry, "After", change.normalizedLine);
        }

        const actions = this.contentEl.createDiv({ cls: "fn-timeline-modal-actions" });
        const cancel = actions.createEl("button", { text: "Cancel" });
        cancel.addEventListener("click", () => this.close());
        const apply = actions.createEl("button", { cls: "mod-cta", text: "Apply formatting" });
        apply.addEventListener("click", () => void this.apply(apply, cancel));
    }

    onClose(): void {
        this.contentEl.empty();
    }

    private renderCode(parent: HTMLElement, label: string, value: string): void {
        const block = parent.createDiv({ cls: "fn-task-format-preview-block" });
        block.createDiv({ cls: "fn-task-format-preview-label", text: label });
        block.createEl("code", { text: value });
    }

    private async apply(applyButton: HTMLButtonElement, cancelButton: HTMLButtonElement): Promise<void> {
        if (this.saving) return;
        this.saving = true;
        applyButton.disabled = true;
        cancelButton.disabled = true;
        applyButton.setText("Applying…");
        try {
            const result = await saveTaskFormatChanges(this.app, this.filePath, this.changes);
            if (result.status === "saved" || result.status === "unchanged") {
                new Notice(result.status === "saved" ? "Task formatting applied." : "Tasks were already formatted.");
                this.close();
                this.onComplete();
                return;
            }

            const detail =
                result.status === "conflict" || result.status === "ambiguous"
                    ? `Line ${result.lineNumber} changed.`
                    : "The note no longer exists.";
            new Notice(`Formatting cancelled. ${detail} Reopen the manager and try again.`);
        } catch {
            new Notice("Formatting could not be applied. The note was not changed.");
        } finally {
            this.saving = false;
            applyButton.disabled = false;
            cancelButton.disabled = false;
            applyButton.setText("Apply formatting");
        }
    }
}
