import { type App, type Component, MarkdownRenderer, setIcon } from "obsidian";
import { isTFile } from "../../../infrastructure/obsidian/vault/ObsidianFileTypes.ts";
import type { RecentEntriesReader } from "../../../infrastructure/obsidian/focus-session/RecentEntriesReader";
import type { FocusTarget } from "../../capture/domain/CaptureTarget";
import type { FocusNotesSettings } from "../../settings/domain/FocusNotesSettings";

/**
 * The Timer sidebar's collapsible "Recent" panel: lists the most recently
 * logged entries in the active note (whichever note the user currently has
 * open, not a specific configured target) and lets the user click one to
 * jump to its line.
 */
export class TimerRecentEntries {
    private recentList!: HTMLElement;
    private recentTitle!: HTMLElement;

    constructor(
        private app: App,
        /** Ties MarkdownRenderer's cleanup and vault/workspace listeners to the owning ItemView's lifecycle. */
        private component: Component,
        private getSettings: () => FocusNotesSettings,
        private buildReader: () => RecentEntriesReader,
    ) {}

    render(parent: HTMLElement): void {
        const details = parent.createEl("details", { cls: "focus-notes-section" });
        details.setAttribute("open", "");
        const summary = details.createEl("summary");
        this.recentTitle = summary.createEl("span", {
            text: "Recent",
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

        // Follow the active note: switching files or editing the current one
        // both refresh the feed, so it always reflects whatever's open now.
        this.component.registerEvent(
            this.app.workspace.on("active-leaf-change", () => void this.refresh()),
        );
        this.component.registerEvent(
            this.app.vault.on("modify", (file) => {
                if (file.path === this.app.workspace.getActiveFile()?.path) void this.refresh();
            }),
        );
    }

    async refresh(): Promise<void> {
        if (!this.recentList) return;
        this.recentList.empty();
        const target = this.activeTarget();
        if (!target.file) {
            this.recentTitle.setText("Recent");
            this.recentList.createDiv({
                cls: "focus-notes-recent-empty",
                text: "No active note.",
            });
            return;
        }
        this.recentTitle.setText(`Recent in “${target.file}”`);
        const reader = this.buildReader();
        const entries = await reader.read(target, this.getSettings().recentEntriesCount);
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
            void MarkdownRenderer.render(this.app, entry.text, item, target.file, this.component);
            item.addEventListener("click", (evt) => {
                // Don't intercept clicks on rendered links — let them follow
                // their hrefs via Obsidian's normal handlers.
                if ((evt.target as HTMLElement).closest("a")) return;
                void this.openAtLine(target.file, entry.lineNumber);
            });
        }
    }

    private async openAtLine(filePath: string, lineNumber: number): Promise<void> {
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (!isTFile(file)) return;
        const leaf = this.app.workspace.getLeaf(false);
        await leaf.openFile(file, { eState: { line: lineNumber } });
    }

    /** Whole-file scan (no heading scoping) of whichever note is currently active. */
    private activeTarget(): FocusTarget {
        const active = this.app.workspace.getActiveFile();
        return {
            file: active?.extension === "md" ? active.path : "",
            heading: "",
            position: this.getSettings().captureFocusSession.position,
        };
    }
}
