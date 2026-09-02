import { AbstractInputSuggest, type App, Setting, type TFile } from "obsidian";
import type { ScheduledItemMentionCandidate } from "../../capture/scheduled-item/application/ScheduledItemMentionIndex.ts";
import { getScheduledItemMentionSource } from "../../../infrastructure/obsidian/suggestions/ObsidianScheduledItemMentionSource.ts";
import { applyInputSuggestion } from "../../capture/moment/ui/SuggestionSelection.ts";
import type { FocusNotesSettings } from "../../settings/domain/FocusNotesSettings.ts";
import type { TimerPurposeSelection } from "../domain/TimerPurposeGate.ts";

export interface TimerPurposeSelectorOptions {
    app: App;
    getSettings: () => FocusNotesSettings;
    onSelectionChanged: (selection: TimerPurposeSelection) => void;
}

/**
 * Timer's single "what is this session for" row: one input that both resolves the required
 * Task/Event owner (Task 42's gate) and doubles as the free-text {{task}} log description —
 * picking a Task/Event candidate sets both; picking a file or typing freely only changes the
 * displayed text, since a file mention or plain text was never a valid owner. Never invents a
 * Task, Event, or timebox on its own; Quick-create always opens the real Create form or Timebox
 * Manager so the write goes through their own validation.
 */
export class TimerPurposeSelector {
    private selection: TimerPurposeSelection = { status: "none" };
    private input!: HTMLInputElement;
    private summaryEl: HTMLElement | null = null;

    constructor(private readonly options: TimerPurposeSelectorOptions) {
        void getScheduledItemMentionSource(options.app).rebuild();
    }

    getSelection(): TimerPurposeSelection {
        return this.selection;
    }

    getFocusText(): string {
        return this.input.value;
    }

    setFocusText(value: string): void {
        this.input.value = value;
    }

    reset(): void {
        this.selection = { status: "none" };
        this.input.value = "";
        this.notify();
        this.renderSummary();
    }

    render(parent: HTMLElement): void {
        const container = parent.createDiv({ cls: "focus-notes-purpose" });
        const setting = new Setting(container)
            .setName("What are you doing?")
            .setDesc("Search a Task or Event to set the session owner, a file to link, or just type freely.");
        this.input = setting.controlEl.createEl("input", {
            type: "text",
            attr: { placeholder: "Search Task, Event, or file…", "aria-label": "What are you doing" },
        });
        new TimerFocusSuggest(this.options.app, this.input, (pick) => this.applyPick(pick));
        // Auto-wrap a typed-out .md path the same way a picked file suggestion already is —
        // matches the plain-text convenience the old standalone "What are you doing" field had.
        this.input.addEventListener("input", () => {
            const value = this.input.value;
            if (/^[^\s[]+\.md$/.test(value)) {
                this.input.value = `[[${value.replace(/\.md$/, "")}]]`;
            }
        });

        this.summaryEl = container.createDiv({ cls: "focus-notes-purpose-summary" });
        this.renderSummary();
    }

    private applyPick(pick: TimerFocusSuggestion): void {
        if (pick.kind === "file") {
            applyInputSuggestion(this.input, `[[${pick.file.basename}]]`);
            return;
        }
        this.input.value = pick.candidate.title;
        this.selection =
            pick.kind === "event"
                ? { status: "event", itemId: pick.candidate.blockId, title: pick.candidate.title }
                : { status: "task", itemId: pick.candidate.blockId, title: pick.candidate.title };
        this.notify();
        this.renderSummary();
    }

    private renderSummary(): void {
        const summaryEl = this.summaryEl;
        if (!summaryEl) return;
        summaryEl.empty();
        if (this.selection.status === "none") return;

        summaryEl.createSpan({
            text: `${this.selection.status === "event" ? "Event" : "Task"}: ${this.selection.title}`,
        });
        const clear = summaryEl.createEl("button", { text: "Change", attr: { type: "button" } });
        clear.addEventListener("click", () => this.reset());
    }

    private notify(): void {
        this.options.onSelectionChanged(this.selection);
    }
}

type TimerFocusSuggestion =
    | { kind: "event" | "task"; candidate: ScheduledItemMentionCandidate }
    | { kind: "file"; file: TFile };

class TimerFocusSuggest extends AbstractInputSuggest<TimerFocusSuggestion> {
    constructor(
        app: App,
        inputEl: HTMLInputElement,
        private readonly onPick: (pick: TimerFocusSuggestion) => void,
    ) {
        super(app, inputEl);
    }

    getSuggestions(query: string): TimerFocusSuggestion[] {
        const source = getScheduledItemMentionSource(this.app);
        const events = source
            .query("event", query, 5, () => undefined)
            .map((candidate): TimerFocusSuggestion => ({ kind: "event", candidate }));
        const tasks = source
            .query("task", query, 5, () => undefined)
            .map((candidate): TimerFocusSuggestion => ({ kind: "task", candidate }));
        const lower = query.trim().toLowerCase();
        const files: TimerFocusSuggestion[] = lower
            ? this.app.vault
                  .getMarkdownFiles()
                  .filter((file) => file.path.toLowerCase().includes(lower))
                  .slice(0, 5)
                  .map((file) => ({ kind: "file", file }))
            : [];
        return [...events, ...tasks, ...files];
    }

    renderSuggestion(item: TimerFocusSuggestion, el: HTMLElement): void {
        if (item.kind === "file") {
            el.setText(`File · ${item.file.path}`);
            return;
        }
        el.setText(`${item.kind === "event" ? "Event" : "Task"} · ${item.candidate.title}`);
    }

    selectSuggestion(item: TimerFocusSuggestion): void {
        this.close();
        this.onPick(item);
    }
}
