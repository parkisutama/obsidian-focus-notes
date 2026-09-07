import { type App, Component, setIcon } from "obsidian";
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
import { MobileFormFields } from "./MobileFormFields.ts";
import { getMobileViewportMetrics } from "./MobileViewport.ts";

export interface TimeboxManagerMobileOptions {
    snapshot: LedgerRecordSnapshot;
    title: string;
    completed: boolean;
    due: TaskTimeboxContext["due"];
    selectedTimeboxId?: string | null;
}

const STATUS_LABELS: Record<TaskTimeboxStatus, string> = {
    planned: "Planned",
    completed: "Completed",
    skipped: "Skipped",
    cancelled: "Cancelled",
};

/** Mobile equivalent of TimeboxManagerModal: same Task 34 service, independent full-screen lifecycle. */
export class TimeboxManagerMobileScreen extends Component {
    private rootEl: HTMLElement | null = null;
    private snapshot: LedgerRecordSnapshot;
    private originalBlock: ScheduledItemBlock | null = null;
    private timeboxes: TaskTimebox[] = [];
    private editingId: string | null;
    private confirmingDeleteId: string | null = null;
    private errorMessage = "";
    private opened = false;
    private fields: MobileFormFields[] = [];

    constructor(
        private readonly app: App,
        private readonly getSettings: () => FocusNotesSettings,
        private readonly options: TimeboxManagerMobileOptions,
        private readonly onComplete: () => void,
    ) {
        super();
        this.snapshot = options.snapshot;
        this.editingId = options.selectedTimeboxId ?? null;
    }

    open(): void {
        if (this.opened) return;
        this.opened = true;
        this.rootEl = this.app.workspace.containerEl.createDiv({
            cls: "fn-mobile-event-screen fn-timebox-manager-mobile",
            attr: { role: "dialog", "aria-modal": "true" },
        });
        document.body.addClass("fn-mobile-event-screen-open");
        this.loadFromSnapshot();
        this.render();
        this.registerViewportLifecycle();
        this.load();
    }

    close(): void {
        if (!this.opened) return;
        this.opened = false;
        this.unload();
    }

    onunload(): void {
        this.destroyFields();
        this.rootEl?.remove();
        this.rootEl = null;
        document.body.removeClass("fn-mobile-event-screen-open");
    }

    private destroyFields(): void {
        for (const fields of this.fields) fields.destroyPickers();
        this.fields = [];
    }

    private loadFromSnapshot(): void {
        const parsed = parseScheduledItemBlock(this.snapshot.rawBlock);
        this.originalBlock = parsed.status === "parsed" ? parsed.block : null;
        this.timeboxes = parsed.status === "parsed" ? parsed.block.timeboxes : [];
    }

    private render(): void {
        const root = this.rootEl;
        if (!root) return;
        this.destroyFields();
        root.empty();
        const header = root.createEl("header", { cls: "fn-mobile-event-header" });
        const cancel = header.createEl("button", {
            cls: "fn-mobile-event-cancel",
            attr: { type: "button", "aria-label": "Close" },
        });
        setIcon(cancel, "x");
        cancel.addEventListener("click", () => this.close());
        header.createDiv({ cls: "fn-mobile-scheduled-title", text: "Manage timeboxes" });

        const body = root.createEl("main", { cls: "fn-mobile-event-body" });
        const fields = new MobileFormFields((change) => change());
        this.fields.push(fields);
        if (this.errorMessage) {
            body.createDiv({
                cls: "fn-scheduled-item-form-error",
                text: this.errorMessage,
                attr: { role: "alert", "aria-live": "polite" },
            });
        }
        if (this.timeboxes.length === 0) body.createDiv({ text: "No timeboxes yet." });
        for (const timebox of this.timeboxes) this.renderRow(body, timebox);
        this.renderAddForm(body, fields);
    }

    private renderRow(container: HTMLElement, timebox: TaskTimebox): void {
        if (this.editingId === timebox.timeboxId) {
            this.renderEditRow(container, timebox);
            return;
        }
        const card = container.createDiv({ cls: "fn-timebox-row" });
        card.createDiv({ cls: "fn-mobile-scheduled-context", text: `${timebox.start} – ${timebox.end}` });
        const statusRow = card.createDiv({ cls: "fn-timebox-row-actions" });
        const select = statusRow.createEl("select", { attr: { "aria-label": "Timebox status" } });
        for (const status of Object.keys(STATUS_LABELS) as TaskTimeboxStatus[]) {
            const option = select.createEl("option", { text: STATUS_LABELS[status], value: status });
            if (status === timebox.status) option.selected = true;
        }
        select.addEventListener("change", () => this.applyStatus(timebox.timeboxId, select.value as TaskTimeboxStatus));

        const editButton = statusRow.createEl("button", { text: "Edit", attr: { type: "button" } });
        editButton.addEventListener("click", () => {
            this.editingId = timebox.timeboxId;
            this.render();
        });

        const isConfirming = this.confirmingDeleteId === timebox.timeboxId;
        const deleteButton = statusRow.createEl("button", {
            text: isConfirming ? "Confirm delete" : "Delete",
            attr: { type: "button" },
        });
        deleteButton.addEventListener("click", () => this.requestDelete(timebox.timeboxId));
    }

    private renderEditRow(container: HTMLElement, timebox: TaskTimebox): void {
        let start = timebox.start;
        let end = timebox.end;
        const fields = new MobileFormFields((change) => change());
        this.fields.push(fields);
        const editor = container.createDiv({ cls: "fn-timebox-editor-row" });
        fields.dateTime(editor, "Start", timebox.start, true, (value) => {
            start = value ?? "";
        });
        fields.dateTime(editor, "End", timebox.end, true, (value) => {
            end = value ?? "";
        });
        const save = editor.createEl("button", { text: "Save", attr: { type: "button" } });
        save.addEventListener("click", () => this.applyEdit(timebox.timeboxId, { start, end }));
        const cancel = editor.createEl("button", { text: "Cancel", attr: { type: "button" } });
        cancel.addEventListener("click", () => {
            this.editingId = null;
            this.render();
        });
    }

    private renderAddForm(container: HTMLElement, fields: MobileFormFields): void {
        let start = "";
        let end = "";
        const editor = container.createDiv({ cls: "fn-timebox-editor-row fn-timebox-add-row" });
        editor.createDiv({ cls: "fn-timebox-editor-title", text: "New timebox" });
        fields.dateTime(editor, "Start", null, true, (value) => {
            start = value ?? "";
        });
        editor.createSpan({ cls: "fn-timebox-separator", text: "–", attr: { "aria-hidden": "true" } });
        fields.dateTime(editor, "End", null, true, (value) => {
            end = value ?? "";
        });
        const add = editor.createEl("button", { text: "Add", cls: "mod-cta", attr: { type: "button" } });
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

    private registerViewportLifecycle(): void {
        const root = this.rootEl;
        if (!root) return;
        const viewport = window.visualViewport;
        const update = (): void => {
            const top = this.app.workspace.containerEl.getBoundingClientRect().top;
            const metrics = getMobileViewportMetrics(window.innerHeight, viewport ?? undefined, top, 8);
            root.style.setProperty("--fn-mobile-screen-height", `${metrics.height}px`);
            root.style.setProperty("--fn-mobile-screen-top", `${metrics.offsetTop}px`);
        };
        update();
        this.registerDomEvent(window, "resize", update);
        this.registerDomEvent(window, "keydown", (event) => {
            if (event.key === "Escape") this.close();
        });
        if (viewport) {
            viewport.addEventListener("resize", update);
            viewport.addEventListener("scroll", update);
            this.register(() => {
                viewport.removeEventListener("resize", update);
                viewport.removeEventListener("scroll", update);
            });
        }
    }
}

function toProjectionTimeboxes(timeboxes: readonly TaskTimebox[]): TaskDayReferenceTimebox[] {
    return timeboxes.flatMap((timebox) => {
        const start = parseLocalDateTime(timebox.start, false);
        const end = parseLocalDateTime(timebox.end, false);
        return start && end ? [{ timeboxId: timebox.timeboxId, start, end }] : [];
    });
}
