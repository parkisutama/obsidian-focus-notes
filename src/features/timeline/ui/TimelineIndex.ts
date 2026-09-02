import type { App } from "obsidian";
import { Notice } from "obsidian";
import { ScheduledItemIndexer } from "../../../infrastructure/obsidian/timeline/ScheduledItemIndexer";
import { isFileInTimelineSource } from "../domain/TimelineSourceAlignment";
import {
    buildTimelineSourceGroups,
    timelineSourceFolders,
    timelineSourceHeadings,
} from "../domain/TimelineSourceGroups";
import { TargetResolver } from "../../../infrastructure/obsidian/capture/TargetResolver";
import { ScheduledItemParser } from "../../capture/scheduled-item/domain/ScheduledItemParser";
import type { ScheduledItem } from "../../capture/scheduled-item/domain/ScheduledItem";
import type { FocusNotesSettings } from "../../settings/domain/FocusNotesSettings";

const SOURCE_COLORS = ["#4c9aff", "#2fb344", "#f59f00", "#e64980", "#15aabf", "#845ef7", "#f76707", "#40c057"];

export type TimelineIndexResult =
    | { status: "disabled" }
    | { status: "empty" }
    | { status: "ok"; items: ScheduledItem[] }
    | { status: "error" };

/**
 * Owns Timeline's Scheduled Item index and the source-group/folder/heading
 * derivation it's built from. Knows nothing about rendering — refreshIndex()
 * returns a result status and lets the caller decide what to draw.
 */
export class TimelineIndex {
    private items: ScheduledItem[] = [];
    private readonly parser = new ScheduledItemParser();
    private indexRefreshTimer: number | null = null;

    constructor(
        private app: App,
        private getSettings: () => FocusNotesSettings,
        private saveSettings: () => Promise<void>,
    ) {}

    getItems(): ScheduledItem[] {
        return this.items;
    }

    async refreshIndex(): Promise<TimelineIndexResult> {
        const settings = this.getSettings();
        if (!settings.timeline.enabled) {
            this.items = [];
            return { status: "disabled" };
        }

        const sourceGroups = this.getEffectiveSourceGroups();
        if (sourceGroups.length === 0) {
            this.items = [];
            return { status: "empty" };
        }

        try {
            const indexer = new ScheduledItemIndexer(this.app, this.parser);
            this.items = await indexer.buildIndex(sourceGroups, this.getEffectiveSourceHeadings());
            this.ensureSourceSettings();
            await this.saveSettings();
            return { status: "ok", items: this.items };
        } catch (err) {
            console.error("[Focus Timeline] Failed to build index", err);
            new Notice("Focus Timeline failed to build index. See console for details.");
            return { status: "error" };
        }
    }

    /** Debounces bursts of vault/metadata events into a single rebuild. */
    scheduleIndexRefresh(onRefreshed: (result: TimelineIndexResult) => void): void {
        if (this.indexRefreshTimer !== null) window.clearTimeout(this.indexRefreshTimer);
        this.indexRefreshTimer = window.setTimeout(() => {
            this.indexRefreshTimer = null;
            void this.refreshIndex().then(onRefreshed);
        }, 150);
    }

    dispose(): void {
        if (this.indexRefreshTimer !== null) window.clearTimeout(this.indexRefreshTimer);
    }

    isInSourceScope(path: string): boolean {
        return isFileInTimelineSource(path, this.getEffectiveSourceFolders());
    }

    getEffectiveSourceFolders(): string[] {
        return timelineSourceFolders(this.getEffectiveSourceGroups());
    }

    getEffectiveSourceGroups() {
        const settings = this.getSettings();
        const dailyFolder = new TargetResolver(settings).getProfileFolder("daily");
        return buildTimelineSourceGroups(settings.timeline.sourceFolders, dailyFolder, settings.inbox.contextSources);
    }

    getEffectiveSourceHeadings(): string[] {
        const settings = this.getSettings();
        return timelineSourceHeadings(settings.timeline.sourceHeadings, [
            settings.captureEvent.heading,
            settings.captureTask.heading,
        ]);
    }

    colorFor(filePath: string): string {
        let hash = 0;
        for (let i = 0; i < filePath.length; i++) hash = (hash + filePath.charCodeAt(i)) % 997;
        return SOURCE_COLORS[hash % SOURCE_COLORS.length];
    }

    private ensureSourceSettings(): void {
        const settings = this.getSettings();
        for (const source of this.getEffectiveSourceGroups()) {
            if (settings.timeline.sourceVisibility[source.id] === undefined) {
                settings.timeline.sourceVisibility[source.id] = true;
            }
            if (!settings.timeline.sourceColors[source.id]) {
                settings.timeline.sourceColors[source.id] = this.colorFor(source.id);
            }
        }
    }
}
