import { type App, Modal, Setting } from "obsidian";
import { saveScheduledItemBlock } from "../../../../../infrastructure/obsidian/capture/ScheduledItemBlockPersistence.ts";
import { isTFile } from "../../../../../infrastructure/obsidian/vault/ObsidianFileTypes.ts";
import { runTaskDayProjection } from "../../../../../infrastructure/obsidian/capture/TaskDayProjectionRuntime.ts";
import { EventTaskWriter } from "../../../../../infrastructure/obsidian/capture/EventTaskWriter.ts";
import {
    addTaskTimebox,
    deleteTaskTimebox,
    editTaskTimebox,
    setTaskTimeboxStatus,
    type TaskTimeboxContext,
} from "../../application/TaskTimeboxOperations.ts";
import { captureLedgerRecord, type LedgerRecordSnapshot } from "../../domain/LedgerRecordSource.ts";
import { extractScheduledItemBlockId } from "../../domain/ScheduledItemBlockId.ts";
import { type ScheduledItemBlock, parseScheduledItemBlock } from "../../domain/ScheduledItemBlockEditor.ts";
import {
    fromDateTimeLocalValue,
    parseLocalDateTime,
    toDateTimeLocalValue,
} from "../../domain/ScheduledItemFormAdapter.ts";
import type { TaskTimebox, TaskTimeboxStatus } from "../../domain/TaskTimebox.ts";
import { planTaskDayReferences, type TaskDayReferenceTimebox } from "../../domain/TaskDayReferencePlan.ts";
import { describeTaskTimeboxWarnings } from "../../domain/TaskTimeboxWarningLabel.ts";
import type { FocusNotesSettings } from "../../../../settings/domain/FocusNotesSettings.ts";

export interface TimeboxManagerOptions {
    snapshot: LedgerRecordSnapshot;
    title: string;
    completed: boolean;
    due: TaskTimeboxContext["due"];
    /** Opened from this timebox's context (e.g. a Timeline segment); pre-selects it for editing. */
    selectedTimeboxId?: string | null;
}

const STATUS_LABELS: Record<TaskTimeboxStatus, string> = {
    planned: "Planned",
    completed: "Completed",
    skipped: "Skipped",
    cancelled: "Cancelled",
};

export class TimeboxManagerModal extends Modal {
    private snapshot: LedgerRecordSnapshot;
    private originalBlock: ScheduledItemBlock | null = null;
    private timeboxes: TaskTimebox[] = [];
    private editingId: string | null;
    private confirmingDeleteId: string | null = null;
    private errorMessage = "";

    constructor(
        app: App,
        private readonly getSettings: () => FocusNotesSettings,
        private readonly options: TimeboxManagerOptions,
        private readonly onComplete: () => void,
    ) {
        super(app);
        this.snapshot = options.snapshot;
        this.editingId = options.selectedTimeboxId ?? null;
    }

    onOpen(): void {
        this.modalEl.addClass("fn-timebox-manager-modal");
        this.loadFromSnapshot();
        this.render();
    }

    onClose(): void {
        this.contentEl.empty();
    }

    private loadFromSnapshot(): void {
        const parsed = parseScheduledItemBlock(this.snapshot.rawBlock);
        this.originalBlock = parsed.status === "parsed" ? parsed.block : null;
        this.timeboxes = parsed.status === "parsed" ? parsed.block.timeboxes : [];
    }

    private render(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h2", { text: "Manage timeboxes" });
        if (this.errorMessage) {
            contentEl.createDiv({
                cls: "fn-scheduled-item-form-error",
                text: this.errorMessage,
                attr: { role: "alert", "aria-live": "polite" },
            });
        }
        if (this.timeboxes.length === 0) {
            contentEl.createDiv({ text: "No timeboxes yet." });
        }
        for (const timebox of this.timeboxes) this.renderRow(contentEl, timebox);
        this.renderAddForm(contentEl);
        const actions = contentEl.createDiv({ cls: "fn-timeline-modal-actions" });
        actions
            .createEl("button", { text: "Close", attr: { type: "button" } })
            .addEventListener("click", () => this.close());
    }

    private renderRow(container: HTMLElement, timebox: TaskTimebox): void {
        if (this.editingId === timebox.timeboxId) {
            this.renderEditRow(container, timebox);
            return;
        }
        const setting = new Setting(container)
            .setName(`${timebox.start} – ${timebox.end}`)
            .setDesc(`Status: ${STATUS_LABELS[timebox.status]}`);
        setting.addDropdown((dropdown) =>
            dropdown
                .addOptions(STATUS_LABELS)
                .setValue(timebox.status)
                .onChange((value) => this.applyStatus(timebox.timeboxId, value as TaskTimeboxStatus)),
        );
        setting.addButton((button) =>
            button.setButtonText("Edit").onClick(() => {
                this.editingId = timebox.timeboxId;
                this.render();
            }),
        );
        if (this.confirmingDeleteId === timebox.timeboxId) {
            setting.addButton((button) =>
                button
                    .setWarning()
                    .setButtonText("Confirm delete")
                    .onClick(() => this.applyDelete(timebox.timeboxId, true)),
            );
        } else {
            setting.addButton((button) =>
                button
                    .setIcon("trash")
                    .setTooltip(timebox.status === "planned" ? "Delete" : "Delete (historical)")
                    .onClick(() => this.requestDelete(timebox.timeboxId)),
            );
        }
    }

    private renderEditRow(container: HTMLElement, timebox: TaskTimebox): void {
        let start = timebox.start;
        let end = timebox.end;
        const setting = new Setting(container).setName("Edit timebox");
        this.renderDateTimeField(setting.controlEl, "Start", timebox.start, (value) => {
            start = value;
        });
        this.renderDateTimeField(setting.controlEl, "End", timebox.end, (value) => {
            end = value;
        });
        setting.addButton((button) =>
            button
                .setCta()
                .setButtonText("Save")
                .onClick(() => this.applyEdit(timebox.timeboxId, { start, end })),
        );
        setting.addButton((button) =>
            button.setButtonText("Cancel").onClick(() => {
                this.editingId = null;
                this.render();
            }),
        );
    }

    /** Native browser date/time picker instead of a free-typed "YYYY-MM-DD HH:mm" string. */
    private renderDateTimeField(
        container: HTMLElement,
        label: string,
        value: string,
        onChange: (value: string) => void,
    ): void {
        const field = container.createDiv({ cls: "fn-timebox-datetime-field" });
        field.createSpan({ cls: "fn-timebox-datetime-label", text: label });
        const input = field.createEl("input", {
            type: "datetime-local",
            cls: "fn-timebox-datetime-input",
            attr: { "aria-label": `Timebox ${label.toLowerCase()}`, lang: "en-GB" },
        });
        input.value = toDateTimeLocalValue(value);
        input.addEventListener("change", () => onChange(fromDateTimeLocalValue(input.value)));
    }

    private renderAddForm(container: HTMLElement): void {
        let start = "";
        let end = "";
        const setting = new Setting(container).setName("Add timebox");
        this.renderDateTimeField(setting.controlEl, "Start", "", (value) => {
            start = value;
        });
        this.renderDateTimeField(setting.controlEl, "End", "", (value) => {
            end = value;
        });
        setting.addButton((button) =>
            button
                .setCta()
                .setButtonText("Add")
                .onClick(() => this.applyAdd({ start, end })),
        );
    }

    private applyAdd(interval: { start: string; end: string }): void {
        const result = addTaskTimebox(this.timeboxes, interval, { due: this.options.due });
        if (result.status === "invalid") {
            this.errorMessage = "End must be later than start.";
            this.render();
            return;
        }
        this.timeboxes = result.timeboxes;
        this.errorMessage = describeTaskTimeboxWarnings(result.warnings);
        void this.persist();
    }

    private applyEdit(timeboxId: string, interval: { start: string; end: string }): void {
        const result = editTaskTimebox(this.timeboxes, timeboxId, interval, { due: this.options.due });
        if (result.status === "invalid") {
            this.errorMessage = "End must be later than start.";
            this.render();
            return;
        }
        if (result.status === "not-found") return;
        this.timeboxes = result.timeboxes;
        this.editingId = null;
        this.errorMessage = describeTaskTimeboxWarnings(result.warnings);
        void this.persist();
    }

    private applyStatus(timeboxId: string, status: TaskTimeboxStatus): void {
        const result = setTaskTimeboxStatus(this.timeboxes, timeboxId, status);
        if (result.status === "not-found") return;
        this.timeboxes = result.timeboxes;
        void this.persist();
    }

    private requestDelete(timeboxId: string): void {
        const timebox = this.timeboxes.find((t) => t.timeboxId === timeboxId);
        if (!timebox) return;
        if (timebox.status === "planned") {
            this.applyDelete(timeboxId, false);
            return;
        }
        this.confirmingDeleteId = timeboxId;
        this.render();
    }

    private applyDelete(timeboxId: string, confirmedHistorical: boolean): void {
        const result = deleteTaskTimebox(this.timeboxes, timeboxId, { confirmedHistorical, hasFocusSessions: false });
        this.confirmingDeleteId = null;
        if (result.status !== "deleted") return;
        this.timeboxes = result.timeboxes;
        void this.persist();
    }

    private async persist(): Promise<void> {
        const original = this.originalBlock;
        if (!original) return;
        const previousTimeboxes = toProjectionTimeboxes(original.timeboxes);
        const result = await saveScheduledItemBlock(this.app, this.snapshot, {
            firstLine: original.firstLine,
            description: original.description,
            detailNote: original.detailNote,
            timeboxes: this.timeboxes,
        });
        if (result.status === "invalid") {
            this.errorMessage = `Could not save: ${result.reason}`;
            this.render();
            return;
        }
        if (result.status === "conflict") {
            this.errorMessage = "This Task changed elsewhere. Close and reopen the manager to continue.";
            this.render();
            return;
        }
        await this.refreshSnapshot();
        await this.writeDayProjection(original.firstLine, previousTimeboxes);
        this.render();
    }

    /** Reconciles due/timebox Daily references now that this Task's timeboxes just changed. */
    private async writeDayProjection(
        canonicalFirstLine: string,
        previousTimeboxes: TaskDayReferenceTimebox[],
    ): Promise<void> {
        const canonicalBlockId = extractScheduledItemBlockId(canonicalFirstLine).blockId;
        if (!canonicalBlockId) return;
        const settings = this.getSettings();
        const writer = new EventTaskWriter(this.app, settings.eventTask, () => settings);
        const dueDayKey = this.options.due ? this.options.due.date.slice(0, 10) : null;
        const nextTimeboxes = toProjectionTimeboxes(this.timeboxes);
        const result = await runTaskDayProjection(
            this.app,
            settings,
            {
                title: this.options.title,
                completed: this.options.completed,
                dueDayKey,
                timeboxes: nextTimeboxes,
                canonicalFilePath: this.snapshot.filePath,
                canonicalBlockId,
                heading: settings.captureTask.heading,
                position: settings.captureTask.position,
            },
            planTaskDayReferences(dueDayKey, previousTimeboxes),
            writer,
        );
        if (result.status === "partial") this.errorMessage = result.message;
    }

    private async refreshSnapshot(): Promise<void> {
        const file = this.app.vault.getAbstractFileByPath(this.snapshot.filePath);
        if (!isTFile(file)) return;
        const content = await this.app.vault.read(file);
        const captured = captureLedgerRecord(content, {
            filePath: this.snapshot.filePath,
            lineNumber: this.snapshot.lineNumber,
            rawLine: this.snapshot.rawLine,
        });
        if (captured.status !== "captured") return;
        this.snapshot = captured.snapshot;
        this.loadFromSnapshot();
        this.onComplete();
    }
}

function toProjectionTimeboxes(timeboxes: readonly TaskTimebox[]): TaskDayReferenceTimebox[] {
    return timeboxes.flatMap((timebox) => {
        const start = parseLocalDateTime(timebox.start, false);
        const end = parseLocalDateTime(timebox.end, false);
        return start && end ? [{ timeboxId: timebox.timeboxId, start, end }] : [];
    });
}
