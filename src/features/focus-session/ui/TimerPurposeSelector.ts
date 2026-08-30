import { AbstractInputSuggest, type App, Setting } from "obsidian";
import type { ScheduledItemMentionCandidate } from "../../capture/scheduled-item/application/ScheduledItemMentionIndex.ts";
import {
    captureLedgerRecord,
    type LedgerRecordSnapshot,
} from "../../capture/scheduled-item/domain/LedgerRecordSource.ts";
import { parseScheduledItemBlock } from "../../capture/scheduled-item/domain/ScheduledItemBlockEditor.ts";
import type { TaskTimebox } from "../../capture/scheduled-item/domain/TaskTimebox.ts";
import { TimeboxManagerModal } from "../../capture/scheduled-item/ui/desktop/TimeboxManagerModal.ts";
import { getScheduledItemMentionSource } from "../../../infrastructure/obsidian/suggestions/ObsidianScheduledItemMentionSource.ts";
import { isTFile } from "../../../infrastructure/obsidian/vault/ObsidianFileTypes.ts";
import type { FocusNotesSettings } from "../../settings/domain/FocusNotesSettings.ts";
import type { TimerPurposeSelection } from "../domain/TimerPurposeGate.ts";

type TaskSelection = Extract<TimerPurposeSelection, { status: "task" }>;

export interface TimerPurposeSelectorOptions {
    app: App;
    getSettings: () => FocusNotesSettings;
    onSelectionChanged: (selection: TimerPurposeSelection) => void;
}

/**
 * Timer's required "what is this session for" picker: search an existing Task/Event (reusing
 * the same mention index @task/@event capture already builds), then — for a Task — pick or
 * create a timebox. Never invents a Task, Event, or timebox on its own; Quick-create always
 * opens the real Create form or Timebox Manager so the write goes through their own validation.
 */
export class TimerPurposeSelector {
    private selection: TimerPurposeSelection = { status: "none" };
    private container: HTMLElement | null = null;
    private readonly candidateById = new Map<string, ScheduledItemMentionCandidate>();

    constructor(private readonly options: TimerPurposeSelectorOptions) {
        void getScheduledItemMentionSource(options.app).rebuild();
    }

    getSelection(): TimerPurposeSelection {
        return this.selection;
    }

    reset(): void {
        this.selection = { status: "none" };
        this.notify();
        this.renderPicker();
    }

    render(parent: HTMLElement): void {
        this.container = parent.createDiv({ cls: "focus-notes-purpose" });
        this.renderPicker();
    }

    private renderPicker(): void {
        const container = this.container;
        if (!container) return;
        container.empty();

        const setting = new Setting(container)
            .setName("Focus on")
            .setDesc("Required: pick the Task or Event this session is for.");
        const input = setting.controlEl.createEl("input", {
            type: "text",
            attr: { placeholder: "Search Task or Event…", "aria-label": "Search Task or Event" },
        });
        new TimerPurposeSuggest(this.options.app, input, (candidate) => this.selectCandidate(candidate));

        if (this.selection.status === "none") return;

        const summary = container.createDiv({ cls: "focus-notes-purpose-summary" });
        summary.createSpan({
            text: `${this.selection.status === "event" ? "Event" : "Task"}: ${this.selection.title}`,
        });
        const clear = summary.createEl("button", { text: "Change", attr: { type: "button" } });
        clear.addEventListener("click", () => this.reset());

        if (this.selection.status === "task") this.renderTimeboxPicker(this.selection);
    }

    private renderTimeboxPicker(selection: TaskSelection): void {
        const container = this.container;
        if (!container) return;
        void this.loadTaskTimeboxes(selection).then((result) => {
            if (!this.container || this.selection.status !== "task") return;
            const row = container.createDiv({ cls: "focus-notes-purpose-timebox" });
            if (!result) {
                row.createSpan({ text: "Could not read this Task's timeboxes." });
                return;
            }
            const planned = result.timeboxes.filter((timebox) => timebox.status === "planned");
            if (planned.length === 0) {
                row.createSpan({ text: "No planned timebox yet." });
                const addButton = row.createEl("button", { text: "Add timebox", attr: { type: "button" } });
                addButton.addEventListener("click", () => {
                    new TimeboxManagerModal(
                        this.options.app,
                        this.options.getSettings,
                        { snapshot: result.snapshot, title: selection.title, completed: false, due: null },
                        () => this.renderPicker(),
                    ).open();
                });
                return;
            }
            this.renderTimeboxSelect(row, selection, planned);
        });
    }

    private renderTimeboxSelect(row: HTMLElement, selection: TaskSelection, planned: TaskTimebox[]): void {
        const select = row.createEl("select", { attr: { "aria-label": "Timebox" } });
        select.createEl("option", { text: "Choose a timebox…", value: "" });
        for (const timebox of planned) {
            select.createEl("option", { text: `${timebox.start} – ${timebox.end}`, value: timebox.timeboxId });
        }
        select.value = selection.timeboxId ?? "";
        select.addEventListener("change", () => {
            if (this.selection.status !== "task") return;
            this.selection = { ...this.selection, timeboxId: select.value || null };
            this.notify();
        });
    }

    private async loadTaskTimeboxes(
        selection: TaskSelection,
    ): Promise<{ snapshot: LedgerRecordSnapshot; timeboxes: TaskTimebox[] } | null> {
        const candidate = this.candidateById.get(selection.itemId);
        if (!candidate) return null;
        const file = this.options.app.vault.getAbstractFileByPath(candidate.filePath);
        if (!isTFile(file)) return null;
        const content = await this.options.app.vault.read(file);
        const rawLine = content.split(/\r?\n/)[candidate.lineNumber - 1];
        if (!rawLine) return null;
        const captured = captureLedgerRecord(content, {
            filePath: candidate.filePath,
            lineNumber: candidate.lineNumber,
            rawLine,
        });
        if (captured.status !== "captured") return null;
        const parsed = parseScheduledItemBlock(captured.snapshot.rawBlock);
        if (parsed.status !== "parsed") return null;
        return { snapshot: captured.snapshot, timeboxes: parsed.block.timeboxes };
    }

    private selectCandidate(candidate: ScheduledItemMentionCandidate): void {
        this.candidateById.set(candidate.blockId, candidate);
        this.selection =
            candidate.kind === "event"
                ? { status: "event", itemId: candidate.blockId, title: candidate.title }
                : { status: "task", itemId: candidate.blockId, title: candidate.title, timeboxId: null };
        this.notify();
        this.renderPicker();
    }

    private notify(): void {
        this.options.onSelectionChanged(this.selection);
    }
}

class TimerPurposeSuggest extends AbstractInputSuggest<ScheduledItemMentionCandidate> {
    constructor(
        app: App,
        private readonly inputEl: HTMLInputElement,
        private readonly onPick: (candidate: ScheduledItemMentionCandidate) => void,
    ) {
        super(app, inputEl);
    }

    getSuggestions(query: string): ScheduledItemMentionCandidate[] {
        const source = getScheduledItemMentionSource(this.app);
        const events = source.query("event", query, 8, () => undefined);
        const tasks = source.query("task", query, 8, () => undefined);
        return [...events, ...tasks];
    }

    renderSuggestion(candidate: ScheduledItemMentionCandidate, el: HTMLElement): void {
        el.setText(`${candidate.kind === "event" ? "Event" : "Task"} · ${candidate.title}`);
    }

    selectSuggestion(candidate: ScheduledItemMentionCandidate): void {
        this.inputEl.value = candidate.title;
        this.close();
        this.onPick(candidate);
    }
}
