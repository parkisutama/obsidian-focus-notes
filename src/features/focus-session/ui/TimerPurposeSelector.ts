import { AbstractInputSuggest, type App, Setting } from "obsidian";
import type { ScheduledItemMentionCandidate } from "../../capture/scheduled-item/application/ScheduledItemMentionIndex.ts";
import { getScheduledItemMentionSource } from "../../../infrastructure/obsidian/suggestions/ObsidianScheduledItemMentionSource.ts";
import type { FocusNotesSettings } from "../../settings/domain/FocusNotesSettings.ts";
import type { TimerPurposeSelection } from "../domain/TimerPurposeGate.ts";

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
    }

    private selectCandidate(candidate: ScheduledItemMentionCandidate): void {
        this.candidateById.set(candidate.blockId, candidate);
        this.selection =
            candidate.kind === "event"
                ? { status: "event", itemId: candidate.blockId, title: candidate.title }
                : { status: "task", itemId: candidate.blockId, title: candidate.title };
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
