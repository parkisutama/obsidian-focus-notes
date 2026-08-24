import { type App, debounce, type EventRef } from "obsidian";
import { isTFile } from "../../../infrastructure/obsidian/ObsidianFileTypes.ts";
import { FileSuggest, HeadingSuggest } from "../../../infrastructure/obsidian/Suggesters";
import type { TargetResolver } from "../../../TargetResolver";
import type { InsertPosition } from "../../../shared/markdown/InsertPosition";
import type { FocusTarget } from "../../capture/domain/CaptureTarget";
import type { FocusNotesSettings } from "../../settings/domain/FocusNotesSettings";

/**
 * The Timer sidebar's collapsible "Log target" section: file/heading/position
 * and group-by-date inputs, plus the resolved-target preview. Live edits here
 * write to settings.liveTarget, which TargetResolver prefers over the
 * configured Focus session capture target.
 */
export class TimerTargetEditor {
    private targetFileInput!: HTMLInputElement;
    private targetResolvedPreviewEl!: HTMLElement;
    private targetHeadingInput!: HTMLInputElement;
    private targetPositionSelect!: HTMLSelectElement;
    private targetGroupToggle!: HTMLInputElement;
    private targetGroupLevelSelect!: HTMLSelectElement;

    constructor(
        private app: App,
        private getSettings: () => FocusNotesSettings,
        private saveSettings: () => Promise<void>,
        private buildResolver: () => TargetResolver,
        private onTargetChanged: () => void,
        private registerEvent: (ref: EventRef) => void,
    ) {}

    render(parent: HTMLElement): void {
        const details = parent.createEl("details", { cls: "focus-notes-section" });
        details.setAttribute("open", "");
        const summary = details.createEl("summary");
        summary.createEl("span", { text: "Log target", cls: "focus-notes-section-title" });

        const body = details.createDiv({ cls: "focus-notes-section-body" });

        // Why "input" instead of "change":
        //   "change" fires only on blur. When AbstractInputSuggest sets the
        //   value programmatically (user picked from the dropdown), it
        //   dispatches "input", not "change", so a "change"-only listener
        //   misses suggester selections entirely. Switching to "input" with
        //   a 300ms debounce makes the suggester picks persist immediately
        //   while keeping per-keystroke saves cheap.
        const persistTargetEdit = debounce(
            () => {
                void this.saveSettings();
                this.onTargetChanged();
            },
            300,
            true,
        );

        // File row
        const fileRow = body.createDiv({ cls: "focus-notes-target-row" });
        fileRow.createEl("label", { text: "File", cls: "focus-notes-target-label" });
        const fileCell = fileRow.createDiv({ cls: "focus-notes-target-cell" });
        this.targetFileInput = fileCell.createEl("input", {
            type: "text",
            cls: "focus-notes-target-input",
            attr: { placeholder: "Path or template, e.g. Daily/{{date:YYYY-MM-DD}}.md" },
        });
        new FileSuggest(this.app, this.targetFileInput);
        this.targetFileInput.addEventListener("input", () => {
            this.getSettings().liveTarget.file = this.targetFileInput.value.trim();
            this.updateTargetResolvedPreview();
            persistTargetEdit();
        });
        this.targetResolvedPreviewEl = fileCell.createDiv({
            cls: "focus-notes-target-resolved",
        });

        // Heading row — uses the file-aware HeadingSuggest so it autocompletes
        // against whatever file path is currently typed in the file input.
        // The thunk re-reads liveTarget on every suggestion query, so keystrokes
        // in the file input propagate to the heading suggester immediately
        // (because we update liveTarget.file on each "input" event above).
        const headingRow = body.createDiv({ cls: "focus-notes-target-row" });
        headingRow.createEl("label", { text: "Heading", cls: "focus-notes-target-label" });
        this.targetHeadingInput = headingRow.createEl("input", {
            type: "text",
            cls: "focus-notes-target-input",
            attr: { placeholder: "(empty = end of file)" },
        });
        new HeadingSuggest(
            this.app,
            this.targetHeadingInput,
            () => this.buildResolver().resolve(this.activeTarget()).file,
        );
        this.targetHeadingInput.addEventListener("input", () => {
            this.getSettings().liveTarget.heading = this.targetHeadingInput.value.trim();
            persistTargetEdit();
        });

        // Position row — a <select> only fires "change" (no per-character
        // editing to debounce), so the simpler immediate save is fine here.
        const posRow = body.createDiv({ cls: "focus-notes-target-row" });
        posRow.createEl("label", { text: "Position", cls: "focus-notes-target-label" });
        this.targetPositionSelect = posRow.createEl("select", {
            cls: "focus-notes-target-input",
        });
        this.targetPositionSelect.createEl("option", { text: "End (newest at bottom)", value: "end" });
        this.targetPositionSelect.createEl("option", { text: "Start (newest at top)", value: "start" });
        this.targetPositionSelect.addEventListener("change", () => {
            this.getSettings().liveTarget.position = this.targetPositionSelect.value as InsertPosition;
            void this.saveSettings();
            this.onTargetChanged();
        });

        // Group-by-date toggle — affects both writer and reader. Lives next to
        // the target picker because it's a per-target structural choice (the
        // user might group by date in their daily note but not in a dedicated
        // log file, or vice versa).
        const groupRow = body.createDiv({ cls: "focus-notes-target-row" });
        groupRow.createEl("label", { text: "Group", cls: "focus-notes-target-label" });
        const groupCell = groupRow.createDiv({ cls: "focus-notes-target-input focus-notes-group-cell" });
        const groupToggle = groupCell.createEl("input", { type: "checkbox" });
        groupToggle.addEventListener("change", () => {
            this.getSettings().groupByDate = groupToggle.checked;
            this.targetGroupLevelSelect.disabled = !groupToggle.checked;
            void this.saveSettings();
            this.onTargetChanged();
        });
        groupCell.createSpan({ text: "by date", cls: "focus-notes-group-label" });
        this.targetGroupLevelSelect = groupCell.createEl("select", {
            cls: "focus-notes-group-level",
        });
        for (const lvl of [2, 3, 4] as const) {
            this.targetGroupLevelSelect.createEl("option", {
                text: `H${lvl}`,
                value: String(lvl),
            });
        }
        this.targetGroupLevelSelect.addEventListener("change", () => {
            const v = parseInt(this.targetGroupLevelSelect.value, 10);
            if (v === 2 || v === 3 || v === 4) {
                this.getSettings().dateSubHeadingLevel = v;
                void this.saveSettings();
            }
        });
        this.targetGroupToggle = groupToggle;

        // Reset to default clears live overrides so later Settings changes
        // keep flowing into this sidebar target.
        const resetLink = body.createEl("a", {
            text: "Reset to default",
            cls: "focus-notes-target-reset",
            href: "#",
        });
        resetLink.addEventListener("click", (evt) => {
            evt.preventDefault();
            this.getSettings().liveTarget = {
                file: "",
                heading: "",
                position: this.getSettings().captureFocusSession.position,
            };
            void this.saveSettings();
            this.syncTargetInputs();
            this.onTargetChanged();
        });

        this.syncTargetInputs();

        // Refresh the recent feed when the active target file is modified
        // outside this view (manual edits, sync, other plugins). The check
        // resolves the active target lazily so token changes don't matter.
        this.registerEvent(
            this.app.vault.on("modify", (file) => {
                if (!isTFile(file)) return;
                const active = this.buildResolver().resolve(this.activeTarget());
                if (file.path === active.file) {
                    this.onTargetChanged();
                }
            }),
        );
    }

    private activeTarget(): FocusTarget {
        return this.buildResolver().getActiveTarget();
    }

    private syncTargetInputs(): void {
        const active = this.activeTarget();
        this.targetFileInput.value = active.file;
        this.targetHeadingInput.value = active.heading;
        this.targetPositionSelect.value = active.position;
        const s = this.getSettings();
        this.targetGroupToggle.checked = s.groupByDate;
        this.targetGroupLevelSelect.value = String(s.dateSubHeadingLevel);
        this.targetGroupLevelSelect.disabled = !s.groupByDate;
        this.updateTargetResolvedPreview();
    }

    private updateTargetResolvedPreview(): void {
        if (!this.targetResolvedPreviewEl) return;
        const resolved = this.buildResolver().resolve(this.activeTarget());
        this.targetResolvedPreviewEl.setText(resolved.file ? `Today: ${resolved.file}` : "");
    }
}
