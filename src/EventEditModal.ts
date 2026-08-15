import { type App, Modal, Notice, Platform, Setting } from "obsidian";
import type { EventLineEdit } from "./EventLineEditor";
import { saveEventLedgerEdit, type SaveEventLedgerEditResult } from "./EventLedgerEditor";
import type { LedgerRecordSnapshot } from "./LedgerRecordSource";
import { shouldUseMobileForm } from "./MobileFormPolicy";

interface DateTimeInput {
    date: string;
    time: string;
}

function splitDateTime(value: string | null): DateTimeInput {
    const [date = "", time = ""] = value?.split(" ") ?? [];
    return { date, time };
}

export function openEventEditForm(
    app: App,
    title: string,
    snapshot: LedgerRecordSnapshot,
    initial: EventLineEdit,
    onComplete: () => void,
): void {
    const mobile = shouldUseMobileForm(Platform.isMobile, window.innerWidth);
    new EventEditModal(app, title, snapshot, initial, onComplete, mobile).open();
}

export class EventEditModal extends Modal {
    private allDay: boolean;
    private start: DateTimeInput;
    private end: DateTimeInput;
    private status: EventLineEdit["status"];
    private actualEnabled: boolean;
    private actualStart: DateTimeInput;
    private actualEnd: DateTimeInput;
    private saving = false;

    constructor(
        app: App,
        private title: string,
        private snapshot: LedgerRecordSnapshot,
        initial: EventLineEdit,
        private onComplete: () => void,
        private mobile = false,
    ) {
        super(app);
        this.allDay = initial.allDay;
        this.start = splitDateTime(initial.start);
        this.end = splitDateTime(initial.end);
        this.status = initial.status;
        this.actualEnabled = initial.actual !== null;
        this.actualStart = splitDateTime(initial.actual?.start ?? initial.start);
        this.actualEnd = splitDateTime(initial.actual?.end ?? initial.end);
    }

    onOpen(): void {
        this.modalEl.addClass("fn-event-edit-modal");
        this.modalEl.toggleClass("fn-event-edit-modal-mobile", this.mobile);
        this.render();
    }

    onClose(): void {
        this.contentEl.empty();
    }

    private render(): void {
        this.contentEl.empty();
        this.contentEl.createEl("h2", { text: "Edit Event" });
        this.contentEl.createDiv({ cls: "fn-event-edit-title", text: this.title });

        new Setting(this.contentEl).setName("All day").addToggle((toggle) =>
            toggle.setValue(this.allDay).onChange((value) => {
                this.allDay = value;
                this.render();
            }),
        );
        this.addDateTimeSetting("Planned start", this.start, !this.allDay);
        if (!this.allDay) this.addDateTimeSetting("Planned end", this.end, true);

        new Setting(this.contentEl).setName("Status").addDropdown((dropdown) =>
            dropdown
                .addOptions({ planned: "Planned", completed: "Completed", cancelled: "Cancelled" })
                .setValue(this.status)
                .onChange((value) => {
                    this.status = value as EventLineEdit["status"];
                    this.render();
                }),
        );
        if (this.status === "completed") {
            new Setting(this.contentEl).setName("Record actual time").addToggle((toggle) =>
                toggle.setValue(this.actualEnabled).onChange((value) => {
                    this.actualEnabled = value;
                    this.render();
                }),
            );
            if (this.actualEnabled) {
                this.addDateTimeSetting("Actual start", this.actualStart, true);
                this.addDateTimeSetting("Actual end", this.actualEnd, true);
            }
        }

        this.contentEl.createDiv({
            cls: "fn-event-edit-source",
            text: `${this.snapshot.filePath} · Line ${this.snapshot.lineNumber}`,
        });
        const actions = this.contentEl.createDiv({ cls: "fn-timeline-modal-actions" });
        actions.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
        const save = actions.createEl("button", { cls: "mod-cta", text: "Save changes" });
        save.addEventListener("click", () => void this.save(save));
    }

    private addDateTimeSetting(name: string, value: DateTimeInput, requireTime: boolean): void {
        const setting = new Setting(this.contentEl).setName(name);
        const date = setting.controlEl.createEl("input", { type: "date", attr: { "aria-label": `${name} date` } });
        date.value = value.date;
        date.addEventListener("change", () => (value.date = date.value));
        if (!requireTime) return;
        const time = setting.controlEl.createEl("input", { type: "time", attr: { "aria-label": `${name} time` } });
        time.value = value.time;
        time.required = true;
        time.addEventListener("change", () => (value.time = time.value));
    }

    private join(value: DateTimeInput): string {
        return value.time ? `${value.date} ${value.time}` : value.date;
    }

    private buildEdit(): EventLineEdit {
        return {
            allDay: this.allDay,
            start: this.allDay ? this.start.date : this.join(this.start),
            end: this.allDay ? null : this.join(this.end),
            status: this.status,
            actual:
                this.status === "completed" && this.actualEnabled
                    ? { start: this.join(this.actualStart), end: this.join(this.actualEnd) }
                    : null,
        };
    }

    private async save(button: HTMLButtonElement): Promise<void> {
        if (this.saving) return;
        this.saving = true;
        button.disabled = true;
        try {
            const result = await saveEventLedgerEdit(this.app, this.snapshot, this.buildEdit());
            if (result.status === "saved" || result.status === "unchanged") {
                new Notice(result.status === "saved" ? "Event updated." : "Event is unchanged.");
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

    private failureMessage(result: Exclude<SaveEventLedgerEditResult, { status: "saved" | "unchanged" }>): string {
        return result.status === "conflict"
            ? "Event source changed or moved. Reopen it from the Timeline before editing."
            : "Event fields are incomplete or invalid. Check planned and actual times.";
    }
}
