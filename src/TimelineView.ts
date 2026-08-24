import { ItemView, TFile, type ViewStateResult, type WorkspaceLeaf } from "obsidian";
import { openEventTaskForm } from "./EventTaskCaptureLauncher";
import { ScheduledItemQuery } from "./ScheduledItemQuery";
import type { ScheduledItem } from "./features/capture/scheduled-item/domain/ScheduledItem";
import type { TimelineMode, TimelineRange } from "./features/timeline/domain/Timeline";
import { TimelineGrid } from "./TimelineGrid";
import { TimelineLayout } from "./TimelineLayout";
import { TimelineHeader } from "./features/timeline/ui/TimelineHeader";
import { TimelineIndex, type TimelineIndexResult } from "./features/timeline/ui/TimelineIndex";
import { TimelineModalLauncher } from "./features/timeline/ui/TimelineModalLauncher";
import { buildTimelineSourceSummaries, TimelineSourceSidebar } from "./TimelineSourceSidebar";
import type { FocusNotesSettings } from "./features/settings/domain/FocusNotesSettings";
import { addDays, formatDayKey, getIsoWeek, startOfDay, startOfWeek } from "./features/timeline/domain/TimelineDate.ts";

export const VIEW_TYPE_FOCUS_TIMELINE = "focus-timeline-view";

export class TimelineView extends ItemView {
    private mode: TimelineMode = "day";
    private anchorDate = startOfDay(new Date());
    private index: TimelineIndex;
    private modalLauncher: TimelineModalLauncher;
    private header: TimelineHeader;
    private query = new ScheduledItemQuery();
    private layout = new TimelineLayout();
    private bodyEl!: HTMLElement;
    private sidebarEl!: HTMLElement;
    private gridEl!: HTMLElement;
    private rootEl!: HTMLElement;

    constructor(
        leaf: WorkspaceLeaf,
        private getSettings: () => FocusNotesSettings,
        private saveSettings: () => Promise<void>,
    ) {
        super(leaf);
        this.mode = this.getSettings().timeline.defaultMode === "multi-day" ? "day" : "day";
        this.index = new TimelineIndex(this.app, this.getSettings, this.saveSettings);
        this.modalLauncher = new TimelineModalLauncher({
            app: this.app,
            getSettings: this.getSettings,
            onRefreshNeeded: () => void this.refreshIndex(),
        });
        this.header = new TimelineHeader({
            app: this.app,
            viewType: VIEW_TYPE_FOCUS_TIMELINE,
            getMode: () => this.mode,
            getAnchorDate: () => this.anchorDate,
            onAdd: () => {
                openEventTaskForm(this.app, this.getSettings, this.anchorDate, () => void this.refreshIndex(), this);
            },
            onToggleSidebar: () => {
                const settings = this.getSettings();
                settings.timeline.sourceSidebarCollapsed = !settings.timeline.sourceSidebarCollapsed;
                void this.saveSettings();
                this.renderContent();
            },
            onPrev: () => this.shift(-1),
            onToday: () => {
                this.anchorDate = startOfDay(new Date());
                this.renderContent();
            },
            onNext: () => this.shift(1),
            onModeChange: (nextMode) => {
                this.mode = nextMode;
                this.getSettings().timeline.defaultMode = nextMode;
                void this.saveSettings();
                this.renderContent();
            },
            onRefresh: () => void this.refreshIndex(),
        });
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
        this.header.setMode(this.mode);
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
        this.header.render(root);
        this.bodyEl = root.createDiv({ cls: "focus-timeline-body" });
        this.sidebarEl = this.bodyEl.createDiv({ cls: "focus-timeline-sidebar" });
        this.gridEl = this.bodyEl.createDiv({ cls: "focus-timeline-main" });
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
        this.header.syncControls(
            this.mode,
            getIsoWeek(this.currentRange().start),
            settings.timeline.sourceSidebarCollapsed,
        );
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
            onOpenPendingItems: (items) => this.modalLauncher.openPendingItems(items),
            onOpenItem: (item) => this.modalLauncher.openItemDetails(item),
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
}
