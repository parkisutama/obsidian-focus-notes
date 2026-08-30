import { type App, type Component, MarkdownRenderer, setIcon } from "obsidian";
import { isTFile } from "../../../infrastructure/obsidian/ObsidianFileTypes.ts";
import type { TargetResolver } from "../../../infrastructure/obsidian/capture/TargetResolver";
import type { RecentEntriesReader } from "../../../infrastructure/obsidian/focus-session/RecentEntriesReader";
import type { FocusTarget } from "../../capture/domain/CaptureTarget";
import type { FocusNotesSettings } from "../../settings/domain/FocusNotesSettings";

/**
 * The Timer sidebar's collapsible "Recent in section" panel: lists the most
 * recent logged entries at the active target and lets the user click one to
 * jump to its line.
 */
export class TimerRecentEntries {
    private recentList!: HTMLElement;
    private recentTitle!: HTMLElement;

    constructor(
        private app: App,
        /** Ties MarkdownRenderer's cleanup to the owning ItemView's lifecycle. */
        private component: Component,
        private getSettings: () => FocusNotesSettings,
        private buildResolver: () => TargetResolver,
        private buildReader: () => RecentEntriesReader,
    ) {}

    render(parent: HTMLElement): void {
        const details = parent.createEl("details", { cls: "focus-notes-section" });
        details.setAttribute("open", "");
        const summary = details.createEl("summary");
        this.recentTitle = summary.createEl("span", {
            text: "Recent in section",
            cls: "focus-notes-section-title",
        });
        const refresh = summary.createEl("button", {
            cls: "focus-notes-section-refresh",
            attr: { "aria-label": "Refresh", title: "Refresh" },
        });
        setIcon(refresh, "refresh-cw");
        refresh.addEventListener("click", (evt) => {
            evt.preventDefault();
            evt.stopPropagation(); // don't toggle <details>
            void this.refresh();
        });

        this.recentList = details.createDiv({ cls: "focus-notes-recent-list" });
    }

    async refresh(): Promise<void> {
        if (!this.recentList) return;
        this.recentList.empty();
        const settings = this.getSettings();
        const resolver = this.buildResolver();
        const resolved = resolver.resolve(this.activeTarget());
        this.recentTitle.setText(resolved.heading ? `Recent in “${resolved.heading}”` : "Recent in target file");
        const reader = this.buildReader();
        const entries = await reader.read(resolved, settings.recentEntriesCount);
        if (entries.length === 0) {
            this.recentList.createDiv({
                cls: "focus-notes-recent-empty",
                text: "No entries yet.",
            });
            return;
        }
        for (const entry of entries) {
            const item = this.recentList.createDiv({ cls: "focus-notes-recent-item" });
            item.setAttr("title", "Click to open at this line");
            // Render markdown so [[wikilinks]] and **bold** display properly.
            // sourcePath is the target file so relative links resolve correctly.
            void MarkdownRenderer.render(this.app, entry.text, item, resolved.file, this.component);
            item.addEventListener("click", (evt) => {
                // Don't intercept clicks on rendered links — let them follow
                // their hrefs via Obsidian's normal handlers.
                if ((evt.target as HTMLElement).closest("a")) return;
                void this.openAtLine(resolved.file, entry.lineNumber);
            });
        }
    }

    private async openAtLine(filePath: string, lineNumber: number): Promise<void> {
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (!isTFile(file)) return;
        const leaf = this.app.workspace.getLeaf(false);
        await leaf.openFile(file, { eState: { line: lineNumber } });
    }

    private activeTarget(): FocusTarget {
        return this.buildResolver().getActiveTarget();
    }
}
