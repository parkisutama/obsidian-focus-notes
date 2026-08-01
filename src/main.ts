import { Plugin, WorkspaceLeaf } from "obsidian";
import { FocusNotesSettings } from "./types";
import { TimerView, VIEW_TYPE_FOCUS_NOTES } from "./TimerView";
import { TimelineView, VIEW_TYPE_FOCUS_TIMELINE } from "./TimelineView";
import { NoteWriter } from "./NoteWriter";
import { TargetResolver } from "./TargetResolver";
import { RecentEntriesReader } from "./RecentEntriesReader";
import { FocusNotesSettingsTab } from "./SettingsTab";
import { loadState, saveState } from "./StateStore";
import { openEventTaskForm } from "./EventTaskModal";

/**
 * Plugin shell.
 *
 * State persistence: settings live at `.obsidian/focus-notes-state.json`
 * rather than the plugin-local data.json, so they survive uninstall/reinstall
 * and ride along with Obsidian Sync. See StateStore for the rationale and
 * the one-time data.json migration.
 *
 * Builders (rather than direct refs) are passed into TimerView so the view
 * always sees the latest settings without us needing a subscription model.
 */
export default class FocusNotesPlugin extends Plugin {
    public settings!: FocusNotesSettings;

    async onload(): Promise<void> {
        await this.loadSettings();

        this.registerView(
            VIEW_TYPE_FOCUS_NOTES,
            leaf =>
                new TimerView(
                    leaf,
                    () => this.settings,
                    () => this.saveSettings(),
                    () => new NoteWriter(this.app, this.settings),
                    () => new TargetResolver(this.app, this.settings),
                    () => new RecentEntriesReader(this.app)
                )
        );

        this.registerView(
            VIEW_TYPE_FOCUS_TIMELINE,
            leaf => new TimelineView(leaf, () => this.settings, () => this.saveSettings())
        );

        this.addRibbonIcon("timer", "Open Focus Notes", () => {
            void this.activateView();
        });

        this.addRibbonIcon("calendar-days", "Open Focus Timeline", () => {
            void this.activateTimelineView();
        });

        this.addCommand({
            id: "open-focus-notes",
            name: "Open Focus Notes panel",
            callback: () => {
                void this.activateView();
            }
        });

        this.addCommand({
            id: "open-focus-timeline",
            name: "Open Focus Timeline",
            callback: () => {
                void this.activateTimelineView();
            }
        });

        this.addCommand({
            id: "create-event-task",
            name: "Create event or task",
            callback: () => {
                openEventTaskForm(
                    this.app,
                    () => this.settings,
                    () => this.saveSettings(),
                    new Date(),
                    undefined,
                    this
                );
            }
        });

        this.addSettingTab(new FocusNotesSettingsTab(this.app, this));
    }

    async loadSettings(): Promise<void> {
        // Pass loadData as a thunk so StateStore can perform the one-time
        // migration from the legacy data.json without coupling the two layers.
        this.settings = await loadState(this.app, () => this.loadData());
    }

    async saveSettings(): Promise<void> {
        await saveState(this.app, this.settings);
    }

    private async activateView(): Promise<void> {
        const { workspace } = this.app;
        const existing = workspace.getLeavesOfType(VIEW_TYPE_FOCUS_NOTES);
        let leaf: WorkspaceLeaf | null = existing[0] ?? null;
        if (!leaf) {
            leaf = workspace.getRightLeaf(false) ?? workspace.getLeftLeaf(false);
            if (leaf) {
                await leaf.setViewState({ type: VIEW_TYPE_FOCUS_NOTES, active: true });
            }
        }
        if (leaf) workspace.revealLeaf(leaf);
    }

    private async activateTimelineView(): Promise<void> {
        const { workspace } = this.app;
        const existing = workspace.getLeavesOfType(VIEW_TYPE_FOCUS_TIMELINE);
        let leaf: WorkspaceLeaf | null = existing[0] ?? null;
        if (!leaf) {
            leaf = workspace.getRightLeaf(false) ?? workspace.getLeftLeaf(false);
            if (leaf) {
                await leaf.setViewState({
                    type: VIEW_TYPE_FOCUS_TIMELINE,
                    active: true,
                    state: { mode: "day" }
                });
            }
        }
        if (leaf) workspace.revealLeaf(leaf);
    }
}
