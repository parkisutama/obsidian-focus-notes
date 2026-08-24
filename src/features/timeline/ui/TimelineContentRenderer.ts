import { ScheduledItemQuery } from "../../../ScheduledItemQuery";
import { TimelineGrid } from "../../../TimelineGrid";
import { TimelineLayout } from "../../../TimelineLayout";
import { buildTimelineSourceSummaries, TimelineSourceSidebar } from "../../../TimelineSourceSidebar";
import type { ScheduledItem } from "../../capture/scheduled-item/domain/ScheduledItem";
import type { TimelineMode, TimelineRange } from "../domain/Timeline";
import type { FocusNotesSettings } from "../../settings/domain/FocusNotesSettings";
import type { TimelineHeader } from "./TimelineHeader";
import type { TimelineIndex } from "./TimelineIndex";
import type { TimelineModalLauncher } from "./TimelineModalLauncher";
import { getIsoWeek } from "../domain/TimelineDate.ts";

export interface TimelineContentRendererOptions {
    getSettings: () => FocusNotesSettings;
    saveSettings: () => Promise<void>;
    index: TimelineIndex;
    header: TimelineHeader;
    modalLauncher: TimelineModalLauncher;
    getMode: () => TimelineMode;
    getAnchorDate: () => Date;
    getRange: () => TimelineRange;
}

/**
 * Timeline's grid/sidebar body: combines the current index snapshot, range,
 * and mode into the source sidebar and the day/week grid, syncing the header
 * controls to match. Delegates item-open/pending-open actions to
 * TimelineModalLauncher rather than launching modals itself.
 */
export class TimelineContentRenderer {
    private readonly query = new ScheduledItemQuery();
    private readonly layout = new TimelineLayout();

    constructor(
        private rootEl: HTMLElement,
        private sidebarEl: HTMLElement,
        private gridEl: HTMLElement,
        private options: TimelineContentRendererOptions,
    ) {}

    renderDisabled(): void {
        this.sidebarEl.empty();
        this.gridEl.empty();
        this.gridEl.createDiv({
            cls: "focus-timeline-empty",
            text: "Focus Timeline is disabled in settings.",
        });
    }

    render(): void {
        const { getSettings, saveSettings, index, header, modalLauncher, getMode, getAnchorDate, getRange } =
            this.options;
        const settings = getSettings();
        const mode = getMode();
        this.rootEl.toggleClass("focus-timeline-day-mode", mode === "day");
        this.rootEl.toggleClass("focus-timeline-multi-day-mode", mode === "multi-day");
        const range = getRange();
        header.syncControls(mode, getIsoWeek(range.start), settings.timeline.sourceSidebarCollapsed);

        const items = index.getItems();
        const allSourceIds = new Set(index.getEffectiveSourceGroups().map((source) => source.id));
        const allRangeItems = this.query.getItemsForRange(items, range, {
            visibleSources: allSourceIds,
            includeCompleted: settings.timeline.showCompletedTasks,
        });
        const allPendingItems = this.query.getPendingTasks(items, getAnchorDate(), allSourceIds);
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
                void saveSettings();
                this.render();
            },
            onToggleCollapsed: (collapsed) => {
                settings.timeline.sourceSidebarCollapsed = collapsed;
                void saveSettings();
                this.render();
            },
        }).render();

        this.gridEl.toggleClass("focus-timeline-main-expanded", settings.timeline.sourceSidebarCollapsed);

        if (index.getEffectiveSourceFolders().length === 0) {
            this.gridEl.empty();
            this.gridEl.createDiv({
                cls: "focus-timeline-empty",
                text: "Configure timeline source folders in plugin settings.",
            });
            return;
        }

        new TimelineGrid(this.gridEl, {
            mode,
            range,
            items: rangeItems,
            pendingItems,
            layout,
            sourceColors: settings.timeline.sourceColors,
            showPendingSummary: settings.timeline.showPendingSummary,
            onOpenPendingItems: (pending) => modalLauncher.openPendingItems(pending),
            onOpenItem: (item) => modalLauncher.openItemDetails(item),
        }).render();
    }

    private buildSourceSummaries(activeItems: ScheduledItem[]) {
        const { getSettings, index } = this.options;
        const settings = getSettings();
        return buildTimelineSourceSummaries(
            index.getEffectiveSourceGroups(),
            activeItems,
            settings.timeline.sourceVisibility,
            settings.timeline.sourceColors,
            (sourceId) => index.colorFor(sourceId),
        );
    }
}
