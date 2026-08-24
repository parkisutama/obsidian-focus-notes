import { ItemView, Notice, setIcon, TFile, type ViewStateResult, type WorkspaceLeaf } from "obsidian";
import { openEventTaskForm } from "./EventTaskCaptureLauncher";
import { openScheduledItemEditor } from "./ScheduledItemEditor";
import { formatScheduledItemBlockTarget } from "./features/capture/scheduled-item/domain/ScheduledItemBlockId.ts";
import { ScheduledItemQuery } from "./ScheduledItemQuery";
import type { ScheduledItem } from "./features/capture/scheduled-item/domain/ScheduledItem";
import type { TimelineMode, TimelineRange } from "./features/timeline/domain/Timeline";
import { TimelineGrid } from "./TimelineGrid";
import { PendingTasksModal, TimelineItemModal } from "./TimelineItemModal";
import { TimelineLayout } from "./TimelineLayout";
import { TimelineIndex, type TimelineIndexResult } from "./features/timeline/ui/TimelineIndex";
import { buildTimelineSourceSummaries, TimelineSourceSidebar } from "./TimelineSourceSidebar";
import type { FocusNotesSettings } from "./features/settings/domain/FocusNotesSettings";
import { addDays, formatDayKey, getIsoWeek, startOfDay, startOfWeek } from "./features/timeline/domain/TimelineDate.ts";

export const VIEW_TYPE_FOCUS_TIMELINE = "focus-timeline-view";

export class TimelineView extends ItemView {
    private mode: TimelineMode = "day";
    private anchorDate = startOfDay(new Date());
    private index: TimelineIndex;
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

    constructor(
        leaf: WorkspaceLeaf,
        private getSettings: () => FocusNotesSettings,
        private saveSettings: () => Promise<void>,
    ) {
        super(leaf);
        this.mode = this.getSettings().timeline.defaultMode === "multi-day" ? "day" : "day";
        this.index = new TimelineIndex(this.app, this.getSettings, this.saveSettings);
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
        };
    }

    async setState(state: unknown, result: ViewStateResult): Promise<void> {
        await super.setState(state, result);
        if (state && typeof state === "object") {
            const next = state as { mode?: unknown; anchorDate?: unknown };
            if (next.mode === "day" || next.mode === "multi-day") this.mode = next.mode;
            if (typeof next.anchorDate === "string") {
                const parsed = new Date(`${next.anchorDate}T00:00:00`);
                if (!Number.isNaN(parsed.getTime())) this.anchorDate = parsed;
            }
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
                if (file instanceof TFile && this.index.isInSourceScope(file.path)) this.scheduleIndexRefresh();
            }),
        );
        this.registerEvent(
            this.app.vault.on("create", (file) => {
                if (file instanceof TFile && this.index.isInSourceScope(file.path)) this.scheduleIndexRefresh();
            }),
        );
        this.registerEvent(
            this.app.vault.on("delete", (file) => {
                if (file instanceof TFile && this.index.isInSourceScope(file.path)) this.scheduleIndexRefresh();
            }),
        );
        this.registerEvent(
            this.app.vault.on("rename", (file, oldPath) => {
                if (
                    file instanceof TFile &&
                    (this.index.isInSourceScope(file.path) || this.index.isInSourceScope(oldPath))
                ) {
                    this.scheduleIndexRefresh();
                }
            }),
        );
        this.registerEvent(
            this.app.metadataCache.on("changed", (file) => {
                if (this.index.isInSourceScope(file.path)) this.scheduleIndexRefresh();
            }),
        );
        this.registerEvent(
            this.app.metadataCache.on("resolved", () => {
                this.scheduleIndexRefresh();
            }),
        );
        this.register(() => this.index.dispose());
        await this.refreshIndex();
    }

    private scheduleIndexRefresh(): void {
        this.index.scheduleIndexRefresh((result) => this.handleIndexResult(result));
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
            void this.openWeeklyPlanner();
        });

        this.modeSelect = controls.createEl("select", { cls: "focus-timeline-mode-select" });
        this.modeSelect.createEl("option", { text: "Day", value: "day" });
        this.modeSelect.createEl("option", { text: "Weekly View", value: "multi-day" });
        this.modeSelect.value = this.mode;
        this.modeSelect.addEventListener("change", () => {
            const nextMode = this.modeSelect.value as TimelineMode;
            if (nextMode === "multi-day" && this.mode === "day") {
                this.modeSelect.value = "day";
                void this.openWeeklyPlanner();
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

    private async openWeeklyPlanner(): Promise<void> {
        const leaf = this.app.workspace.getLeaf("tab");
        await leaf.setViewState({
            type: VIEW_TYPE_FOCUS_TIMELINE,
            active: true,
            state: {
                mode: "multi-day",
                anchorDate: formatDayKey(this.anchorDate),
            },
        });
        this.app.workspace.revealLeaf(leaf);
    }

    private async refreshIndex(): Promise<void> {
        this.handleIndexResult(await this.index.refreshIndex());
    }

    private handleIndexResult(result: TimelineIndexResult): void {
        if (result.status === "error") return;
        if (result.status === "disabled") {
            this.renderDisabled();
            return;
        }
        this.renderContent();
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
        const range = this.currentRange();
        const items = this.index.getItems();
        const allSourceIds = new Set(this.index.getEffectiveSourceGroups().map((source) => source.id));
        const allRangeItems = this.query.getItemsForRange(items, range, {
            visibleSources: allSourceIds,
            includeCompleted: settings.timeline.showCompletedTasks,
        });
        const allPendingItems = this.query.getPendingTasks(items, this.anchorDate, allSourceIds);
        const sources = this.buildSourceSummaries([...allRangeItems, ...allPendingItems]);
        const visibleSources = new Set(sources.filter((source) => source.visible).map((source) => source.id));
        const rangeItems = allRangeItems.filter((item) => visibleSources.has(item.source.groupId));
        const pendingItems = allPendingItems.filter((item) => visibleSources.has(item.source.groupId));
        const layout = this.layout.build(rangeItems, range);

        new TimelineSourceSidebar(this.sidebarEl, {
            sources,
            collapsed: settings.timeline.sourceSidebarCollapsed,
            onToggleSource: (sourceId, visible) => {
                settings.timeline.sourceVisibility[sourceId] = visible;
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

        if (this.index.getEffectiveSourceFolders().length === 0) {
            this.gridEl.empty();
            this.gridEl.createDiv({
                cls: "focus-timeline-empty",
                text: "Configure timeline source folders in plugin settings.",
            });
            return;
        }

        new TimelineGrid(this.gridEl, {
            mode: this.mode,
            range,
            items: rangeItems,
            pendingItems,
            layout,
            sourceColors: settings.timeline.sourceColors,
            showPendingSummary: settings.timeline.showPendingSummary,
            onOpenPendingItems: (items) => this.openPendingItems(items),
            onOpenItem: (item) => this.openItemDetails(item),
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

    private buildSourceSummaries(activeItems: ScheduledItem[]) {
        const settings = this.getSettings();
        return buildTimelineSourceSummaries(
            this.index.getEffectiveSourceGroups(),
            activeItems,
            settings.timeline.sourceVisibility,
            settings.timeline.sourceColors,
            (sourceId) => this.index.colorFor(sourceId),
        );
    }

    private openItemDetails(item: ScheduledItem): void {
        new TimelineItemModal(
            this.app,
            item,
            (selected) => void this.openSourceItem(selected),
            (selected) => void this.openItemEditor(selected),
        ).open();
    }

    private async openItemEditor(item: ScheduledItem): Promise<void> {
        await openScheduledItemEditor(this.app, item, this.getSettings, () => void this.refreshIndex());
    }

    private openPendingItems(items: ScheduledItem[]): void {
        new PendingTasksModal(this.app, items, (item) => this.openItemDetails(item)).open();
    }

    private async openSourceItem(item: ScheduledItem): Promise<void> {
        const file = this.app.vault.getAbstractFileByPath(item.source.filePath);
        if (!(file instanceof TFile)) {
            new Notice(`Source note not found: ${item.source.filePath}`);
            return;
        }
        if (item.blockId) {
            await this.app.workspace.openLinkText(
                formatScheduledItemBlockTarget(item.source.filePath, item.blockId),
                item.source.filePath,
                false,
            );
            return;
        }
        const leaf = this.app.workspace.getLeaf(false);
        await leaf.openFile(file, {
            active: true,
            eState: { line: Math.max(0, item.source.lineNumber - 1) },
        });
    }
}
