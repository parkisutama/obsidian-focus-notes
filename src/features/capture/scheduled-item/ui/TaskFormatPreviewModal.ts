import { type App, Modal, Notice } from "obsidian";
import { saveTaskFormatChanges } from "../../../../infrastructure/obsidian/capture/TaskFormatWriter";
import { saveScheduledItemBlockFormatChanges } from "../../../../infrastructure/obsidian/capture/ScheduledItemBlockFormatWriter.ts";
import type { TaskFormatChange } from "../domain/TaskFormatWriter";
import type { ScheduledItemBlockFormatChange } from "../domain/ScheduledItemBlockFormat.ts";

export class TaskFormatPreviewModal extends Modal {
    private saving = false;

    constructor(
        app: App,
        private filePath: string,
        private lineChanges: TaskFormatChange[],
        private blockChanges: ScheduledItemBlockFormatChange[],
        private onComplete: () => void,
    ) {
        super(app);
    }

    onOpen(): void {
        this.modalEl.addClass("fn-task-format-preview-modal");
        this.contentEl.empty();
        const total = this.lineChanges.length + this.blockChanges.length;
        this.contentEl.createEl("h2", { text: `Format ${total} item${total === 1 ? "" : "s"}` });
        this.contentEl.createDiv({
            cls: "fn-task-format-preview-subtitle",
            text: "Review every change before updating the note.",
        });

        const list = this.contentEl.createDiv({ cls: "fn-task-format-preview-list" });
        for (const change of this.lineChanges) {
            const entry = list.createDiv({ cls: "fn-task-format-preview-entry" });
            entry.createDiv({ cls: "fn-task-format-preview-line", text: `Line ${change.lineNumber}` });
            this.renderCode(entry, "Before", change.rawLine);
            this.renderCode(entry, "After", change.normalizedLine);
        }
        for (const change of this.blockChanges) {
            const entry = list.createDiv({ cls: "fn-task-format-preview-entry" });
            entry.createDiv({ cls: "fn-task-format-preview-line", text: `Line ${change.lineNumber}` });
            this.renderCode(entry, "Before", change.rawLine);
            this.renderCode(entry, "After", change.normalizedBlock);
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
            // Identity insertion (single line) always lands before block canonicalization: it
            // never changes line counts, so the block pass's captured line numbers stay valid
            // whether or not the identity pass actually wrote anything.
            if (this.lineChanges.length > 0) {
                const lineResult = await saveTaskFormatChanges(this.app, this.filePath, this.lineChanges);
                if (lineResult.status === "conflict" || lineResult.status === "ambiguous") {
                    new Notice(formatFailureMessage(lineResult));
                    return;
                }
                if (lineResult.status === "file-missing") {
                    new Notice(formatFailureMessage(lineResult));
                    return;
                }
            }
            if (this.blockChanges.length > 0) {
                const blockResult = await saveScheduledItemBlockFormatChanges(
                    this.app,
                    this.filePath,
                    this.blockChanges,
                );
                if (blockResult.status === "conflict" || blockResult.status === "ambiguous") {
                    new Notice(formatFailureMessage(blockResult));
                    return;
                }
                if (blockResult.status === "file-missing") {
                    new Notice(formatFailureMessage(blockResult));
                    return;
                }
            }
            new Notice("Task formatting applied.");
            this.close();
            this.onComplete();
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

function formatFailureMessage(
    result: { status: "conflict" | "ambiguous"; lineNumber: number } | { status: "file-missing" },
): string {
    const detail =
        result.status === "file-missing" ? "The note no longer exists." : `Line ${result.lineNumber} changed.`;
    return `Formatting cancelled. ${detail} Reopen the manager and try again.`;
}
