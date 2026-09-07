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
import { parseLocalDateTime } from "../../domain/ScheduledItemFormAdapter.ts";
import type { TaskTimebox, TaskTimeboxStatus } from "../../domain/TaskTimebox.ts";
import { planTaskDayReferences, type TaskDayReferenceTimebox } from "../../domain/TaskDayReferencePlan.ts";
import { describeTaskTimeboxWarnings } from "../../domain/TaskTimeboxWarningLabel.ts";
import type { FocusNotesSettings } from "../../../../settings/domain/FocusNotesSettings.ts";
import { DateTimeInput } from "../../../../../infrastructure/obsidian/datetime/DateTimeInput.ts";
import { editTaskLine, parseTaskLineEdit } from "../../domain/TaskLineEditor.ts";

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
    private reminders: string[] = [];
    private editingId: string | null;
    private confirmingDeleteId: string | null = null;
    private errorMessage = "";
    private dateTimePickers: DateTimeInput[] = [];

    constructor(
        app: App,
        private readonly getSettings: () => FocusNotesSettings,
        private readonly options: TimeboxManagerOptions,
        private readonly onComplete: (snapshot: LedgerRecordSnapshot, reminders: string[]) => void,
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
        this.destroyDateTimePickers();
        this.contentEl.empty();
    }

    private loadFromSnapshot(): void {
        const parsed = parseScheduledItemBlock(this.snapshot.rawBlock);
        this.originalBlock = parsed.status === "parsed" ? parsed.block : null;
        this.timeboxes = parsed.status === "parsed" ? parsed.block.timeboxes : [];
        const task = parsed.status === "parsed" ? parseTaskLineEdit(parsed.block.firstLine) : null;
        this.reminders = task?.status === "parsed" ? [...task.edit.reminders] : [];
    }

    private destroyDateTimePickers(): void {
        for (const picker of this.dateTimePickers) picker.destroy();
        this.dateTimePickers = [];
    }

    private render(): void {
        this.destroyDateTimePickers();
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h2", { text: "Planning" });
        if (this.errorMessage) {
            contentEl.createDiv({
                cls: "fn-scheduled-item-form-error",
                text: this.errorMessage,
                attr: { role: "alert", "aria-live": "polite" },
            });
        }
        this.renderReminders(contentEl);
        const timeboxes = contentEl.createEl("details", { cls: "fn-planning-section", attr: { open: "" } });
        timeboxes.createEl("summary", { text: `Timeboxes · ${this.timeboxes.length}` });
        const timeboxBody = timeboxes.createDiv({ cls: "fn-planning-section-body" });
        if (this.timeboxes.length === 0) timeboxBody.createDiv({ cls: "fn-planning-empty", text: "No timeboxes yet." });
        for (const timebox of this.timeboxes) this.renderRow(timeboxBody, timebox);
        this.renderAddForm(timeboxBody);
        const actions = contentEl.createDiv({ cls: "fn-timeline-modal-actions" });
        actions
            .createEl("button", { text: "Back to task", attr: { type: "button" } })
            .addEventListener("click", () => this.close());
    }

    private renderReminders(container: HTMLElement): void {
        const details = container.createEl("details", { cls: "fn-planning-section", attr: { open: "" } });
        details.createEl("summary", { text: `Reminders · ${this.reminders.length}` });
        const body = details.createDiv({ cls: "fn-planning-section-body" });
        const add = new Setting(body).setName("New reminder");
        add.settingEl.addClass("fn-planning-add-row");
        let next = "";
        this.renderDateTimeField(add.controlEl, "When", "", (value) => (next = value));
        add.addButton((button) =>
            button
                .setIcon("plus")
                .setTooltip("Add reminder")
                .onClick(() => {
                    if (!next) return;
                    this.reminders.push(next);
                    void this.persist();
                }),
        );
        for (const [index, reminder] of this.reminders.entries()) {
            const row = new Setting(body).setName(reminder);
            row.settingEl.addClass("fn-reminder-row");
            if (isPastReminder(reminder)) row.settingEl.addClass("is-past");
            row.addButton((button) =>
                button
                    .setIcon("trash")
                    .setTooltip("Delete reminder")
                    .onClick(() => {
                        this.reminders.splice(index, 1);
                        void this.persist();
                    }),
            );
        }
    }

    private renderRow(container: HTMLElement, timebox: TaskTimebox): void {
        if (this.editingId === timebox.timeboxId) {
            this.renderEditRow(container, timebox);
            return;
        }
        const setting = new Setting(container).setName(`${timebox.start} – ${timebox.end}`);
        setting.settingEl.addClass("fn-timebox-row");
        setting.addDropdown((dropdown) =>
            dropdown
                .addOptions(STATUS_LABELS)
                .setValue(timebox.status)
                .onChange((value) => this.applyStatus(timebox.timeboxId, value as TaskTimeboxStatus)),
        );
        setting.addButton((button) =>
            button
                .setIcon("pencil")
                .setTooltip("Edit timebox")
                .onClick(() => {
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
        setting.settingEl.addClass("fn-timebox-editor-row");
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

    /** Custom DD/MM/YYYY + 24-hour picker instead of a free-typed "YYYY-MM-DD HH:mm" string — see DateTimeInput.ts. */
    private renderDateTimeField(
        container: HTMLElement,
        label: string,
        value: string,
        onChange: (value: string) => void,
    ): void {
        const field = container.createDiv({ cls: "fn-timebox-datetime-field" });
        field.createSpan({ cls: "fn-timebox-datetime-label", text: label });
        const picker = new DateTimeInput(field, {
            initialValue: value || null,
            requireTime: true,
            ariaLabel: `Timebox ${label.toLowerCase()}`,
            onChange: (next) => onChange(next ?? ""),
        });
        this.dateTimePickers.push(picker);
    }

    private renderAddForm(container: HTMLElement): void {
        let start = "";
        let end = "";
        const editor = container.createDiv({ cls: "fn-timebox-editor-row fn-timebox-add-row" });
        editor.createDiv({ cls: "fn-timebox-editor-title", text: "New timebox" });
        const controls = editor.createDiv({ cls: "fn-timebox-add-controls" });
        this.renderDateTimeField(controls, "Start", "", (value) => {
            start = value;
        });
        controls.createSpan({ cls: "fn-timebox-separator", text: "–", attr: { "aria-hidden": "true" } });
        this.renderDateTimeField(controls, "End", "", (value) => {
            end = value;
        });
        const add = controls.createEl("button", { cls: "mod-cta", text: "Add", attr: { type: "button" } });
        add.addEventListener("click", () => this.applyAdd({ start, end }));
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
        const parsedTask = parseTaskLineEdit(original.firstLine);
        if (parsedTask.status !== "parsed") return;
        const firstLine = editTaskLine(original.firstLine, { ...parsedTask.edit, reminders: this.reminders });
        if (firstLine.status !== "ready") return;
        const previousTimeboxes = toProjectionTimeboxes(original.timeboxes);
        const result = await saveScheduledItemBlock(this.app, this.snapshot, {
            firstLine: firstLine.line,
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
        this.onComplete(this.snapshot, [...this.reminders]);
    }
}

function isPastReminder(value: string): boolean {
    const parsed = Date.parse(value.replace(" ", "T"));
    return Number.isFinite(parsed) && parsed < Date.now();
}

function toProjectionTimeboxes(timeboxes: readonly TaskTimebox[]): TaskDayReferenceTimebox[] {
    return timeboxes.flatMap((timebox) => {
        const start = parseLocalDateTime(timebox.start, false);
        const end = parseLocalDateTime(timebox.end, false);
        return start && end ? [{ timeboxId: timebox.timeboxId, start, end }] : [];
    });
}
