import { type App, Modal, Notice, Setting } from "obsidian";
import type { LedgerRecordSnapshot } from "./LedgerRecordSource";
import { saveTaskLedgerEdit, type SaveTaskLedgerEditResult } from "./TaskLedgerEditor";
import type { TaskLineEdit } from "./TaskLineEditor";

interface DateTimeInput {
    date: string;
    time: string;
}

function splitDateTime(value: string | null): DateTimeInput {
    const [date = "", time = ""] = value?.split(" ") ?? [];
    return { date, time };
}

export class TaskEditModal extends Modal {
    private completed: boolean;
    private priority: TaskLineEdit["priority"];
    private due: DateTimeInput;
    private timeboxEnabled: boolean;
    private timeboxStart: DateTimeInput;
    private timeboxEnd: DateTimeInput;
    private reminders: DateTimeInput[];
    private saving = false;

    constructor(
        app: App,
        private title: string,
        private snapshot: LedgerRecordSnapshot,
        initial: TaskLineEdit,
        private onComplete: () => void,
    ) {
        super(app);
        this.completed = initial.completed;
        this.priority = initial.priority;
        this.due = splitDateTime(initial.due);
        this.timeboxEnabled = initial.timebox !== null;
        this.timeboxStart = splitDateTime(initial.timebox?.start ?? null);
        this.timeboxEnd = splitDateTime(initial.timebox?.end ?? null);
        this.reminders = initial.reminders.map(splitDateTime);
    }

    onOpen(): void {
        this.modalEl.addClass("fn-task-edit-modal");
        this.render();
    }

    onClose(): void {
        this.contentEl.empty();
    }

    private render(): void {
        this.contentEl.empty();
        this.contentEl.createEl("h2", { text: "Edit Task" });
        this.contentEl.createDiv({ cls: "fn-task-edit-title", text: this.title });

        new Setting(this.contentEl)
            .setName("Completed")
            .addToggle((toggle) => toggle.setValue(this.completed).onChange((value) => (this.completed = value)));
        new Setting(this.contentEl).setName("Priority").addDropdown((dropdown) =>
            dropdown
                .addOptions({ normal: "Normal", low: "Low", medium: "Medium", high: "High" })
                .setValue(this.priority)
                .onChange((value) => (this.priority = value as TaskLineEdit["priority"])),
        );

        this.addDateTimeSetting("Due", this.due, false);
        new Setting(this.contentEl).setName("Timebox").addToggle((toggle) =>
            toggle.setValue(this.timeboxEnabled).onChange((value) => {
                this.timeboxEnabled = value;
                this.render();
            }),
        );
        if (this.timeboxEnabled) {
            this.addDateTimeSetting("Timebox start", this.timeboxStart, true);
            this.addDateTimeSetting("Timebox end", this.timeboxEnd, true);
        }

        const remindersHeading = new Setting(this.contentEl).setName("Reminders");
        remindersHeading.addButton((button) =>
            button.setButtonText("Add reminder").onClick(() => {
                this.reminders.push({ date: this.due.date, time: "09:00" });
                this.render();
            }),
        );
        this.reminders.forEach((reminder, index) => {
            const row = this.addDateTimeSetting(`Reminder ${index + 1}`, reminder, true);
            row.addButton((button) =>
                button
                    .setIcon("trash")
                    .setTooltip(`Remove reminder ${index + 1}`)
                    .onClick(() => {
                        this.reminders.splice(index, 1);
                        this.render();
                    }),
            );
        });

        this.contentEl.createDiv({
            cls: "fn-task-edit-source",
            text: `${this.snapshot.filePath} · Line ${this.snapshot.lineNumber}`,
        });
        const actions = this.contentEl.createDiv({ cls: "fn-timeline-modal-actions" });
        actions.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
        const save = actions.createEl("button", { cls: "mod-cta", text: "Save changes" });
        save.disabled = this.saving;
        save.addEventListener("click", () => void this.save(save));
    }

    private addDateTimeSetting(name: string, value: DateTimeInput, requireTime: boolean): Setting {
        const setting = new Setting(this.contentEl).setName(name);
        const date = setting.controlEl.createEl("input", { type: "date", attr: { "aria-label": `${name} date` } });
        date.value = value.date;
        date.addEventListener("change", () => (value.date = date.value));
        const time = setting.controlEl.createEl("input", { type: "time", attr: { "aria-label": `${name} time` } });
        time.value = value.time;
        time.required = requireTime;
        time.addEventListener("change", () => (value.time = time.value));
        return setting;
    }

    private buildEdit(): TaskLineEdit {
        const join = (value: DateTimeInput, requireTime: boolean): string | null => {
            if (!value.date) return null;
            return value.time ? `${value.date} ${value.time}` : requireTime ? `${value.date} ` : value.date;
        };
        return {
            completed: this.completed,
            priority: this.priority,
            due: join(this.due, false),
            timebox: this.timeboxEnabled
                ? { start: join(this.timeboxStart, true) ?? "", end: join(this.timeboxEnd, true) ?? "" }
                : null,
            reminders: this.reminders.map((value) => join(value, true) ?? ""),
        };
    }

    private async save(button: HTMLButtonElement): Promise<void> {
        if (this.saving) return;
        this.saving = true;
        button.disabled = true;
        try {
            const result = await saveTaskLedgerEdit(this.app, this.snapshot, this.buildEdit());
            if (result.status === "saved" || result.status === "unchanged") {
                new Notice(result.status === "saved" ? "Task updated." : "Task is unchanged.");
                this.close();
                this.onComplete();
                return;
            }
            new Notice(this.failureMessage(result));
        } finally {
            this.saving = false;
            button.disabled = false;
        }
    }

    private failureMessage(result: Exclude<SaveTaskLedgerEditResult, { status: "saved" | "unchanged" }>): string {
        return result.status === "conflict"
            ? "Task source changed or moved. Reopen it from the Timeline before editing."
            : "Task fields are incomplete or invalid. Check the dates and times.";
    }
}
