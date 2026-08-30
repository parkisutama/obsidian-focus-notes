import type { App, TFile } from "obsidian";
import { detectTaskReferenceCheckboxToggles } from "../../../features/capture/scheduled-item/domain/TaskReferenceCheckboxToggle.ts";
import type { FocusNotesSettings } from "../../../features/settings/domain/FocusNotesSettings.ts";
import { syncTaskReferenceCompletion } from "./TaskReferenceCompletionSync.ts";
import { WriteSuppressionTracker } from "./WriteSuppressionTracker.ts";

/**
 * Plugin-lifetime watcher: treats a user checking/unchecking a Task reference in any Markdown
 * file as a completion command against its canonical Task. Caches each file's last-seen content
 * to diff against, and uses a WriteSuppressionTracker so the writes this triggers never re-enter
 * this same handler as if a user had made them.
 */
export class TaskReferenceCheckboxWatcher {
    private readonly tracker = new WriteSuppressionTracker();
    private readonly previousContent = new Map<string, string>();

    constructor(
        private readonly app: App,
        private readonly getSettings: () => FocusNotesSettings,
    ) {}

    async handleModify(file: TFile): Promise<void> {
        if (file.extension !== "md") return;
        const path = file.path;
        const next = await this.app.vault.cachedRead(file);

        if (this.tracker.isSuppressed(path)) {
            // Our own write echoing back as a "modify" event — refresh the cache silently so the
            // next genuine diff is accurate, but never re-enter sync from an echo of our own change.
            this.previousContent.set(path, next);
            return;
        }

        const previous = this.previousContent.get(path);
        this.previousContent.set(path, next);
        for (const toggle of detectTaskReferenceCheckboxToggles(previous, next)) {
            await syncTaskReferenceCompletion(this.app, this.getSettings(), toggle, this.tracker);
        }
    }
}
