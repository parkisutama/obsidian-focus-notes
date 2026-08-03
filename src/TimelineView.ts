import { ItemView, Notice, TFile, type ViewStateResult, type WorkspaceLeaf, setIcon } from "obsidian";
import { ScheduledItemIndexer } from "./ScheduledItemIndexer";
import { ScheduledItemParser } from "./ScheduledItemParser";
import { ScheduledItemQuery } from "./ScheduledItemQuery";
import type { ScheduledItem, TimelineMode, TimelineRange } from "./ScheduledItemTypes";
import { TimelineGrid } from "./TimelineGrid";
import { TimelineLayout } from "./TimelineLayout";
import { TimelineSourceSidebar, type TimelineSourceSummary } from "./TimelineSourceSidebar";
import type { FocusNotesSettings } from "./types";
import { addDays, formatDayKey, getIsoWeek, startOfDay, startOfWeek } from "./utils";
import { openEventTaskForm } from "./EventTaskModal";
import { TargetResolver } from "./TargetResolver";
import { effectiveTimelineSourceFolders, isFileInTimelineSource } from "./TimelineSourceAlignment";

export const VIEW_TYPE_FOCUS_TIMELINE = "focus-timeline-view";

const SOURCE_COLORS = ["#4c9aff", "#2fb344", "#f59f00", "#e64980", "#15aabf", "#845ef7", "#f76707", "#40c057"];

export class TimelineView extends ItemView {
    private mode: TimelineMode = "day";
    private anchorDate = startOfDay(new Date());
    private items: ScheduledItem[] = [];
    private parser = new ScheduledItemParser();
    private query = new ScheduledItemQuery();
    private layout = new TimelineLayout();
    private bodyEl!: HTMLElement;
    private sidebarEl!: HTMLElement;
    private gridEl!: HTMLElement;
    private rootEl!: HTMLElement;
    private modeSelect!: HTMLSelectElement;
    private weeklyOpenButton!: HTMLButtonElement;
    private weekLabel!: HTMLElement;
    private sourceToggleButton!: HTMLButtonElement;
    private openPendingAfterRender = false;

    constructor(
        leaf: WorkspaceLeaf,
        private getSettings: () => FocusNotesSettings,
        private saveSettings: () => Promise<void>,
    ) {
        super(leaf);
        this.mode = this.getSettings().timeline.defaultMode === "multi-day" ? "day" : "day";
    }

    getViewType(): string {
        return VIEW_TYPE_FOCUS_TIMELINE;
    }

    getDisplayText(): string {
        return "Focus Timeline";
    }

    getIcon(): string {
        return "calendar-days";
    }

    getState(): Record<string, unknown> {
        return {
            ...super.getState(),
            mode: this.mode,
            anchorDate: formatDayKey(this.anchorDate),
            openPendingSummary: this.openPendingAfterRender,
        };
    }

    async setState(state: unknown, result: ViewStateResult): Promise<void> {
        await super.setState(state, result);
        if (state && typeof state === "object") {
            const next = state as { mode?: unknown; anchorDate?: unknown; openPendingSummary?: unknown };
            if (next.mode === "day" || next.mode === "multi-day") this.mode = next.mode;
            if (typeof next.anchorDate === "string") {
                const parsed = new Date(`${next.anchorDate}T00:00:00`);
                if (!Number.isNaN(parsed.getTime())) this.anchorDate = parsed;
            }
            this.openPendingAfterRender = next.openPendingSummary === true;
        }
        if (this.modeSelect) this.modeSelect.value = this.mode;
        if (this.gridEl) this.renderContent();
    }

    async onOpen(): Promise<void> {
        const root = this.containerEl.children[1] as HTMLElement;
        root.empty();
        root.addClass("focus-timeline-view");
        this.rootEl = root;

        this.renderShell(root);
        this.registerEvent(
            this.app.vault.on("modify", (file) => {
                if (file instanceof TFile && this.isInSourceScope(file.path)) void this.refreshIndex();
            }),
        );
        await this.refreshIndex();
    }

    private renderShell(root: HTMLElement): void {
        const header = root.createDiv({ cls: "focus-timeline-header" });
        const titleRow = header.createDiv({ cls: "focus-timeline-title-row" });
        titleRow.createDiv({ cls: "focus-timeline-title", text: "Focus Timeline" });

        const controls = header.createDiv({ cls: "focus-timeline-controls" });

        const addBtn = controls.createEl("button", {
            cls: "focus-timeline-add-button",
            attr: { "aria-label": "Tambah event atau task", title: "Tambah event atau task" },
        });
        setIcon(addBtn, "plus");
        addBtn.addEventListener("click", () => {
            openEventTaskForm(this.app, this.getSettings, this.anchorDate, () => void this.refreshIndex(), this);
        });

        this.sourceToggleButton = controls.createEl("button", {
            cls: "focus-timeline-source-toggle",
            attr: { "aria-label": "Toggle sources", title: "Toggle sources" },
        });
        setIcon(this.sourceToggleButton, "panel-left");
        this.sourceToggleButton.addEventListener("click", () => {
            const settings = this.getSettings();
            settings.timeline.sourceSidebarCollapsed = !settings.timeline.sourceSidebarCollapsed;
            void this.saveSettings();
            this.renderContent();
        });
        this.weekLabel = controls.createDiv({ cls: "focus-timeline-week-label" });
        this.addButton(controls, "Prev", () => this.shift(-1));
        this.addButton(controls, "Today", () => {
            this.anchorDate = startOfDay(new Date());
            this.renderContent();
        });
        this.addButton(controls, "Next", () => this.shift(1));

        this.weeklyOpenButton = controls.createEl("button", {
            cls: "focus-timeline-weekly-open-button",
            attr: {
                "aria-label": "Open Weekly View",
                title: "Open Weekly View",
            },
        });
        setIcon(this.weeklyOpenButton, "calendar-range");
        this.weeklyOpenButton.addEventListener("click", () => {
            void this.openWeeklyPlanner(false);
        });

        this.modeSelect = controls.createEl("select", { cls: "focus-timeline-mode-select" });
        this.modeSelect.createEl("option", { text: "Day", value: "day" });
        this.modeSelect.createEl("option", { text: "Weekly View", value: "multi-day" });
        this.modeSelect.value = this.mode;
        this.modeSelect.addEventListener("change", () => {
            const nextMode = this.modeSelect.value as TimelineMode;
            if (nextMode === "multi-day" && this.mode === "day") {
                this.modeSelect.value = "day";
                void this.openWeeklyPlanner(false);
                return;
            }

            this.mode = nextMode;
            this.getSettings().timeline.defaultMode = nextMode;
            void this.saveSettings();
            this.renderContent();
        });

        this.addButton(controls, "Refresh", () => void this.refreshIndex());

        this.bodyEl = root.createDiv({ cls: "focus-timeline-body" });
        this.sidebarEl = this.bodyEl.createDiv({ cls: "focus-timeline-sidebar" });
        this.gridEl = this.bodyEl.createDiv({ cls: "focus-timeline-main" });
    }

    private addButton(parent: HTMLElement, text: string, onClick: () => void): HTMLButtonElement {
        const button = parent.createEl("button", { cls: "focus-timeline-small-button", text });
        button.addEventListener("click", onClick);
        return button;
    }

    private async openWeeklyPlanner(openPendingSummary: boolean): Promise<void> {
        const leaf = this.app.workspace.getLeaf("tab");
        await leaf.setViewState({
            type: VIEW_TYPE_FOCUS_TIMELINE,
            active: true,
            state: {
                mode: "multi-day",
                anchorDate: formatDayKey(this.anchorDate),
                openPendingSummary,
            },
        });
        this.app.workspace.revealLeaf(leaf);
    }

    private async refreshIndex(): Promise<void> {
        const settings = this.getSettings();
        if (!settings.timeline.enabled) {
            this.items = [];
            this.renderDisabled();
            return;
        }

        const sourceFolders = this.getEffectiveSourceFolders();
        if (sourceFolders.length === 0) {
            this.items = [];
            this.renderContent();
            return;
        }

        try {
            const indexer = new ScheduledItemIndexer(this.app, this.parser);
            this.items = await indexer.buildIndex(sourceFolders);
            this.ensureSourceSettings();
            await this.saveSettings();
            this.renderContent();
        } catch (err) {
            console.error("[Focus Timeline] Failed to build index", err);
            new Notice("Focus Timeline failed to build index. See console for details.");
        }
    }

    private renderDisabled(): void {
        this.sidebarEl.empty();
        this.gridEl.empty();
        this.gridEl.createDiv({
            cls: "focus-timeline-empty",
            text: "Focus Timeline is disabled in settings.",
        });
    }

    private renderContent(): void {
        const settings = this.getSettings();
        this.rootEl.toggleClass("focus-timeline-day-mode", this.mode === "day");
        this.rootEl.toggleClass("focus-timeline-multi-day-mode", this.mode === "multi-day");
        if (this.modeSelect) this.modeSelect.value = this.mode;
        if (this.modeSelect) this.modeSelect.toggleClass("focus-timeline-mode-select--hidden", this.mode === "day");
        if (this.weeklyOpenButton)
            this.weeklyOpenButton.toggleClass("focus-timeline-weekly-open-button--hidden", this.mode !== "day");
        if (this.weekLabel) this.weekLabel.setText(`Week ${getIsoWeek(this.currentRange().start)}`);
        if (this.sourceToggleButton) {
            this.sourceToggleButton.toggleClass(
                "focus-timeline-source-toggle--active",
                !settings.timeline.sourceSidebarCollapsed,
            );
            this.sourceToggleButton.setAttr(
                "aria-label",
                settings.timeline.sourceSidebarCollapsed ? "Show sources" : "Hide sources",
            );
            this.sourceToggleButton.setAttr(
                "title",
                settings.timeline.sourceSidebarCollapsed ? "Show sources" : "Hide sources",
            );
        }
        const sources = this.buildSourceSummaries();
        const visibleSources = new Set(sources.filter((source) => source.visible).map((source) => source.filePath));
        const range = this.currentRange();
        const rangeItems = this.query.getItemsForRange(this.items, range, {
            visibleSources,
            includeCompleted: settings.timeline.showCompletedTasks,
        });
        const pendingItems = this.query.getPendingTasks(this.items, this.anchorDate, visibleSources);
        const layout = this.layout.build(rangeItems, range);

        new TimelineSourceSidebar(this.sidebarEl, {
            sources,
            collapsed: settings.timeline.sourceSidebarCollapsed,
            onToggleSource: (filePath, visible) => {
                settings.timeline.sourceVisibility[filePath] = visible;
                void this.saveSettings();
                this.renderContent();
            },
            onToggleCollapsed: (collapsed) => {
                settings.timeline.sourceSidebarCollapsed = collapsed;
                void this.saveSettings();
                this.renderContent();
            },
        }).render();

        this.gridEl.toggleClass("focus-timeline-main-expanded", settings.timeline.sourceSidebarCollapsed);

        if (this.getEffectiveSourceFolders().length === 0) {
            this.gridEl.empty();
            this.gridEl.createDiv({
                cls: "focus-timeline-empty",
                text: "Configure timeline source folders in plugin settings.",
            });
            return;
        }

        const openPendingSummary = this.openPendingAfterRender;
        this.openPendingAfterRender = false;
        new TimelineGrid(this.gridEl, {
            mode: this.mode,
            range,
            items: rangeItems,
            pendingItems,
            layout,
            sourceColors: settings.timeline.sourceColors,
            showPendingSummary: settings.timeline.showPendingSummary,
            openPendingSummary,
            onOpenPendingSummary: () => void this.openWeeklyPlanner(true),
            onOpenItem: (item) => void this.openItem(item),
        }).render();
    }

    private currentRange(): TimelineRange {
        const start =
            this.mode === "multi-day"
                ? startOfWeek(this.anchorDate, this.getSettings().timeline.weekStartsOn)
                : startOfDay(this.anchorDate);
        const days = this.mode === "day" ? 1 : Math.max(1, this.getSettings().timeline.multiDaySpanDays);
        return { start, end: addDays(start, days) };
    }

    private shift(direction: number): void {
        const days = this.mode === "day" ? 1 : Math.max(1, this.getSettings().timeline.multiDaySpanDays);
        this.anchorDate = addDays(this.anchorDate, direction * days);
        this.renderContent();
    }

    private buildSourceSummaries(): TimelineSourceSummary[] {
        const settings = this.getSettings();
        const counts = new Map<string, { fileName: string; count: number }>();
        for (const item of this.items) {
            const existing = counts.get(item.source.filePath) ?? {
                fileName: item.source.fileName,
                count: 0,
            };
            existing.count += 1;
            counts.set(item.source.filePath, existing);
        }

        return Array.from(counts.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([filePath, value]) => ({
                filePath,
                fileName: value.fileName,
                count: value.count,
                color: settings.timeline.sourceColors[filePath] ?? this.colorFor(filePath),
                visible: settings.timeline.sourceVisibility[filePath] ?? true,
            }));
    }

    private ensureSourceSettings(): void {
        const settings = this.getSettings();
        for (const item of this.items) {
            if (settings.timeline.sourceVisibility[item.source.filePath] === undefined) {
                settings.timeline.sourceVisibility[item.source.filePath] = true;
            }
            if (!settings.timeline.sourceColors[item.source.filePath]) {
                settings.timeline.sourceColors[item.source.filePath] = this.colorFor(item.source.filePath);
            }
        }
    }

    private colorFor(filePath: string): string {
        let hash = 0;
        for (let i = 0; i < filePath.length; i++) hash = (hash + filePath.charCodeAt(i)) % 997;
        return SOURCE_COLORS[hash % SOURCE_COLORS.length];
    }

    private isInSourceScope(path: string): boolean {
        return isFileInTimelineSource(path, this.getEffectiveSourceFolders());
    }

    private getEffectiveSourceFolders(): string[] {
        const settings = this.getSettings();
        const dailyFolder = settings.useDailyNotesAsDefault
            ? new TargetResolver(this.app, settings).getDailyNoteFolder()
            : null;
        return effectiveTimelineSourceFolders(settings.timeline.sourceFolders, dailyFolder);
    }

    private async openItem(item: ScheduledItem): Promise<void> {
        const file = this.app.vault.getAbstractFileByPath(item.source.filePath);
        if (!(file instanceof TFile)) {
            new Notice(`Source note not found: ${item.source.filePath}`);
            return;
        }
        const leaf = this.app.workspace.getLeaf(false);
        await leaf.openFile(file, {
            active: true,
            eState: { line: Math.max(0, item.source.lineNumber - 1) },
        });
    }
}
