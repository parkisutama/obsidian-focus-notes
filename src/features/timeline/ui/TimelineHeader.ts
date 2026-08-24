import type { App } from "obsidian";
import { setIcon } from "obsidian";
import type { TimelineMode } from "../domain/Timeline";
import { formatDayKey } from "../domain/TimelineDate.ts";

export interface TimelineHeaderOptions {
    app: App;
    /** VIEW_TYPE_FOCUS_TIMELINE, passed in rather than imported to avoid a cycle with TimelineView.ts. */
    viewType: string;
    getMode: () => TimelineMode;
    getAnchorDate: () => Date;
    onAdd: () => void;
    onToggleSidebar: () => void;
    onPrev: () => void;
    onToday: () => void;
    onNext: () => void;
    onModeChange: (mode: TimelineMode) => void;
    onRefresh: () => void;
}

/**
 * Timeline's header bar: title, add button, source-sidebar toggle, week
 * label, prev/today/next, weekly-open button, mode select, and refresh.
 * Reports user intent through callbacks; carries no settings-mutation logic
 * of its own.
 */
export class TimelineHeader {
    private modeSelect!: HTMLSelectElement;
    private weeklyOpenButton!: HTMLButtonElement;
    private weekLabel!: HTMLElement;
    private sourceToggleButton!: HTMLButtonElement;

    constructor(private options: TimelineHeaderOptions) {}

    render(root: HTMLElement): void {
        const header = root.createDiv({ cls: "focus-timeline-header" });
        const titleRow = header.createDiv({ cls: "focus-timeline-title-row" });
        titleRow.createDiv({ cls: "focus-timeline-title", text: "Focus Timeline" });

        const controls = header.createDiv({ cls: "focus-timeline-controls" });

        const addBtn = controls.createEl("button", {
            cls: "focus-timeline-add-button",
            attr: { "aria-label": "Tambah event atau task", title: "Tambah event atau task" },
        });
        setIcon(addBtn, "plus");
        addBtn.addEventListener("click", () => this.options.onAdd());

        this.sourceToggleButton = controls.createEl("button", {
            cls: "focus-timeline-source-toggle",
            attr: { "aria-label": "Toggle sources", title: "Toggle sources" },
        });
        setIcon(this.sourceToggleButton, "panel-left");
        this.sourceToggleButton.addEventListener("click", () => this.options.onToggleSidebar());

        this.weekLabel = controls.createDiv({ cls: "focus-timeline-week-label" });
        this.addButton(controls, "Prev", () => this.options.onPrev());
        this.addButton(controls, "Today", () => this.options.onToday());
        this.addButton(controls, "Next", () => this.options.onNext());

        this.weeklyOpenButton = controls.createEl("button", {
            cls: "focus-timeline-weekly-open-button",
            attr: {
                "aria-label": "Open Weekly View",
                title: "Open Weekly View",
            },
        });
        setIcon(this.weeklyOpenButton, "calendar-range");
        this.weeklyOpenButton.addEventListener("click", () => {
            void this.openWeeklyPlanner();
        });

        this.modeSelect = controls.createEl("select", { cls: "focus-timeline-mode-select" });
        this.modeSelect.createEl("option", { text: "Day", value: "day" });
        this.modeSelect.createEl("option", { text: "Weekly View", value: "multi-day" });
        this.modeSelect.value = this.options.getMode();
        this.modeSelect.addEventListener("change", () => {
            const nextMode = this.modeSelect.value as TimelineMode;
            if (nextMode === "multi-day" && this.options.getMode() === "day") {
                this.modeSelect.value = "day";
                void this.openWeeklyPlanner();
                return;
            }
            this.options.onModeChange(nextMode);
        });

        this.addButton(controls, "Refresh", () => this.options.onRefresh());
    }

    /** Called after every content render to sync toggle states and labels. */
    syncControls(mode: TimelineMode, weekNumber: number, sourceSidebarCollapsed: boolean): void {
        if (this.modeSelect) this.modeSelect.value = mode;
        if (this.modeSelect) this.modeSelect.toggleClass("focus-timeline-mode-select--hidden", mode === "day");
        if (this.weeklyOpenButton)
            this.weeklyOpenButton.toggleClass("focus-timeline-weekly-open-button--hidden", mode !== "day");
        if (this.weekLabel) this.weekLabel.setText(`Week ${weekNumber}`);
        if (this.sourceToggleButton) {
            this.sourceToggleButton.toggleClass("focus-timeline-source-toggle--active", !sourceSidebarCollapsed);
            this.sourceToggleButton.setAttr("aria-label", sourceSidebarCollapsed ? "Show sources" : "Hide sources");
            this.sourceToggleButton.setAttr("title", sourceSidebarCollapsed ? "Show sources" : "Hide sources");
        }
    }

    /** Syncs only the mode select, for setState() before a full render happens. */
    setMode(mode: TimelineMode): void {
        if (this.modeSelect) this.modeSelect.value = mode;
    }

    private addButton(parent: HTMLElement, text: string, onClick: () => void): HTMLButtonElement {
        const button = parent.createEl("button", { cls: "focus-timeline-small-button", text });
        button.addEventListener("click", onClick);
        return button;
    }

    private async openWeeklyPlanner(): Promise<void> {
        const leaf = this.options.app.workspace.getLeaf("tab");
        await leaf.setViewState({
            type: this.options.viewType,
            active: true,
            state: {
                mode: "multi-day",
                anchorDate: formatDayKey(this.options.getAnchorDate()),
            },
        });
        this.options.app.workspace.revealLeaf(leaf);
    }
}
