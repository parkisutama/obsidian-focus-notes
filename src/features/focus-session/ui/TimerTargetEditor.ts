import { type App, type EventRef } from "obsidian";
import { isTFile } from "../../../infrastructure/obsidian/vault/ObsidianFileTypes.ts";
import type { TargetResolver } from "../../../infrastructure/obsidian/capture/TargetResolver";
import type { FocusTarget } from "../../capture/domain/CaptureTarget";
import type { FocusNotesSettings } from "../../settings/domain/FocusNotesSettings";

/**
 * The Timer sidebar's collapsible "More options" section — just the group-by-date toggle now.
 * Save to/Heading/Insert position used to live here as a per-session override (settings.liveTarget),
 * but that's removed: the Focus session log target always follows the configured "Focus session
 * capture" settings, with no live override.
 */
export class TimerTargetEditor {
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
        summary.createEl("span", { text: "More options", cls: "focus-notes-section-title" });

        const body = details.createDiv({ cls: "focus-notes-section-body" });

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
        return this.buildResolver().getDefaultTarget();
    }

    private syncTargetInputs(): void {
        const s = this.getSettings();
        this.targetGroupToggle.checked = s.groupByDate;
        this.targetGroupLevelSelect.value = String(s.dateSubHeadingLevel);
        this.targetGroupLevelSelect.disabled = !s.groupByDate;
    }
}
