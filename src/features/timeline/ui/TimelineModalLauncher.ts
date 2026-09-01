import { type App, Notice, TFile } from "obsidian";
import { openScheduledItemEditor } from "../../capture/ui/ScheduledItemEditor";
import { formatScheduledItemBlockTarget } from "../../capture/scheduled-item/domain/ScheduledItemBlockId.ts";
import type { ScheduledItem } from "../../capture/scheduled-item/domain/ScheduledItem";
import type { FocusNotesSettings } from "../../settings/domain/FocusNotesSettings";
import { PendingTasksModal, TimelineItemModal } from "./TimelineItemModal";
import { summarizeScheduledItemFocusFromItems } from "../application/ScheduledItemFocusSummary.ts";
import type { TimelineSelectedSegment } from "../domain/TimelineItemModalModel";

export interface TimelineModalLauncherOptions {
    app: App;
    getSettings: () => FocusNotesSettings;
    onRefreshNeeded: () => void;
}

/**
 * Timeline's modal-launching concern: item details, the pending-tasks list,
 * jumping to an item's editor, and opening the source note at the item's
 * line/block.
 */
export class TimelineModalLauncher {
    constructor(private options: TimelineModalLauncherOptions) {}

    /**
     * `allItems` is the full unfiltered index (not just the current visible range) so a Task's
     * owner-level summary (Task 61) counts every Timebox and Focus Session regardless of whether
     * it falls inside the currently displayed range.
     */
    openItemDetails(item: ScheduledItem, allItems: ScheduledItem[] = [item], selectedSegment: TimelineSelectedSegment | null = null): void {
        new TimelineItemModal(
            this.options.app,
            item,
            (selected) => void this.openSourceItem(selected),
            (selected) => void this.openItemEditor(selected),
            summarizeScheduledItemFocusFromItems(allItems, item.id),
            selectedSegment,
        ).open();
    }

    async openItemEditor(item: ScheduledItem): Promise<void> {
        await openScheduledItemEditor(this.options.app, item, this.options.getSettings, () =>
            this.options.onRefreshNeeded(),
        );
    }

    openPendingItems(items: ScheduledItem[]): void {
        new PendingTasksModal(this.options.app, items, (item) => this.openItemDetails(item)).open();
    }

    private async openSourceItem(item: ScheduledItem): Promise<void> {
        const { app } = this.options;
        const file = app.vault.getAbstractFileByPath(item.source.filePath);
        if (!(file instanceof TFile)) {
            new Notice(`Source note not found: ${item.source.filePath}`);
            return;
        }
        if (item.blockId) {
            await app.workspace.openLinkText(
                formatScheduledItemBlockTarget(item.source.filePath, item.blockId),
                item.source.filePath,
                false,
            );
            return;
        }
        const leaf = app.workspace.getLeaf(false);
        await leaf.openFile(file, {
            active: true,
            eState: { line: Math.max(0, item.source.lineNumber - 1) },
        });
    }
}
