import { ItemView, TFile, type ViewStateResult, type WorkspaceLeaf } from "obsidian";
import { openEventTaskForm } from "../../capture/ui/EventTaskCaptureLauncher";
import type { FocusNotesSettings } from "../../settings/domain/FocusNotesSettings";
import type { TimelineMode, TimelineRange } from "../domain/Timeline";
import { addDays, formatDayKey, startOfDay, startOfWeek } from "../domain/TimelineDate.ts";
import { TimelineContentRenderer } from "./TimelineContentRenderer";
import { TimelineHeader } from "./TimelineHeader";
import { TimelineIndex, type TimelineIndexResult } from "./TimelineIndex";
import { TimelineModalLauncher } from "./TimelineModalLauncher";

export const VIEW_TYPE_FOCUS_TIMELINE = "focus-timeline-view";

export class TimelineView extends ItemView {
    private mode: TimelineMode = "day";
    private anchorDate = startOfDay(new Date());
    private index: TimelineIndex;
    private modalLauncher: TimelineModalLauncher;
    private header: TimelineHeader;
    private contentRenderer!: TimelineContentRenderer;
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
                this.contentRenderer.render();
            },
            onPrev: () => this.shift(-1),
            onToday: () => {
                this.anchorDate = startOfDay(new Date());
                this.contentRenderer.render();
            },
            onNext: () => this.shift(1),
            onModeChange: (nextMode) => {
                this.mode = nextMode;
                this.getSettings().timeline.defaultMode = nextMode;
                void this.saveSettings();
                this.contentRenderer.render();
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
        if (this.contentRenderer) this.contentRenderer.render();
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
        this.contentRenderer = new TimelineContentRenderer(this.rootEl, this.sidebarEl, this.gridEl, {
            getSettings: this.getSettings,
            saveSettings: this.saveSettings,
            index: this.index,
            header: this.header,
            modalLauncher: this.modalLauncher,
            getMode: () => this.mode,
            getAnchorDate: () => this.anchorDate,
            getRange: () => this.currentRange(),
        });
    }

    private async refreshIndex(): Promise<void> {
        this.handleIndexResult(await this.index.refreshIndex());
    }

    private handleIndexResult(result: TimelineIndexResult): void {
        if (result.status === "error") return;
        if (result.status === "disabled") {
            this.contentRenderer.renderDisabled();
            return;
        }
        this.contentRenderer.render();
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
        this.contentRenderer.render();
    }
}
