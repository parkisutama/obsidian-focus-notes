import { Plugin, type WorkspaceLeaf } from "obsidian";
import { type FocusNotesSettings, mergeSettingsWithDefaults } from "./types";
import { TimerView, VIEW_TYPE_FOCUS_NOTES } from "./TimerView";
import { TimelineView, VIEW_TYPE_FOCUS_TIMELINE } from "./TimelineView";
import { NoteWriter } from "./NoteWriter";
import { TargetResolver } from "./TargetResolver";
import { RecentEntriesReader } from "./RecentEntriesReader";
import { FocusNotesSettingsTab } from "./SettingsTab";
import { StateStore } from "./StateStore";
import { openEventTaskForm } from "./EventTaskModal";

/**
 * Plugin shell.
 *
 * State persistence uses Obsidian's Plugin.loadData()/saveData() contract so
 * plugin configuration sync treats it consistently across platforms.
 * StateStore retains ordered writes and migrates the former config-root file.
 *
 * Builders (rather than direct refs) are passed into TimerView so the view
 * always sees the latest settings without us needing a subscription model.
 */
export default class FocusNotesPlugin extends Plugin {
    public settings!: FocusNotesSettings;
    private stateStore!: StateStore;

    async onload(): Promise<void> {
        await this.loadSettings();

        this.registerHoverLinkSource("focus-notes-inbox", {
            display: "Focus Notes",
            defaultMod: false,
        });

        this.registerView(
            VIEW_TYPE_FOCUS_NOTES,
            (leaf) =>
                new TimerView(
                    leaf,
                    () => this.settings,
                    () => this.saveSettings(),
                    () => new NoteWriter(this.app, this.settings),
                    () => new TargetResolver(this.app, this.settings),
                    () => new RecentEntriesReader(this.app),
                ),
        );

        this.registerView(
            VIEW_TYPE_FOCUS_TIMELINE,
            (leaf) =>
                new TimelineView(
                    leaf,
                    () => this.settings,
                    () => this.saveSettings(),
                ),
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
            },
        });

        this.addCommand({
            id: "open-focus-timeline",
            name: "Open Focus Timeline",
            callback: () => {
                void this.activateTimelineView();
            },
        });

        this.addCommand({
            id: "create-event-task",
            name: "Create event or task",
            callback: () => {
                openEventTaskForm(this.app, () => this.settings, new Date(), undefined, this);
            },
        });

        this.addSettingTab(new FocusNotesSettingsTab(this.app, this));
    }

    async loadSettings(): Promise<void> {
        this.stateStore = new StateStore(this.app, mergeSettingsWithDefaults);
        const result = await this.stateStore.load(
            () => this.loadData(),
            (settings) => this.saveData(settings),
        );
        this.settings = result.settings;
    }

    async saveSettings(): Promise<void> {
        await this.stateStore.save(this.settings);
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
                    state: { mode: "day" },
                });
            }
        }
        if (leaf) workspace.revealLeaf(leaf);
    }
}
