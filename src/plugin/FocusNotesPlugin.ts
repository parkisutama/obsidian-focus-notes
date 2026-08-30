import { Notice, Plugin, TFile, type WorkspaceLeaf } from "obsidian";
import { openActiveNoteManager } from "../features/capture/scheduled-item/ui/ActiveNoteManagerLauncher";
import { openEventTaskForm } from "../features/capture/ui/EventTaskCaptureLauncher";
import { StateStore } from "../features/settings/infrastructure/StateStore";
import { FocusNotesSettingsTab } from "../features/settings/ui/SettingsTab";
import { TargetResolver } from "../infrastructure/obsidian/capture/TargetResolver";
import { NoteWriter } from "../infrastructure/obsidian/focus-session/NoteWriter";
import { RecentEntriesReader } from "../infrastructure/obsidian/focus-session/RecentEntriesReader";
import { TimelineView, VIEW_TYPE_FOCUS_TIMELINE } from "../features/timeline/ui/TimelineView";
import { TimerView, VIEW_TYPE_FOCUS_NOTES } from "../features/focus-session/ui/TimerView";
import type { FocusNotesSettings } from "../features/settings/domain/FocusNotesSettings";
import { mergeSettingsWithDefaults } from "../features/settings/domain/SettingsDefaults";
import { TaskReferenceCheckboxWatcher } from "../infrastructure/obsidian/capture/TaskReferenceCheckboxWatcher.ts";
import {
    type ProjectionReconciliationSummary,
    repairOrphanProjectionReferences,
    runProjectionReconciliation,
} from "../infrastructure/obsidian/capture/ProjectionReconciliationRunner.ts";

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
    private lastReconciliationSummary: ProjectionReconciliationSummary | null = null;

    async onload(): Promise<void> {
        await this.loadSettings();

        this.registerHoverLinkSource("focus-notes-inbox", {
            display: "Focus Notes",
            defaultMod: false,
        });

        const taskReferenceCheckboxWatcher = new TaskReferenceCheckboxWatcher(this.app, () => this.settings);
        this.registerEvent(
            this.app.vault.on("modify", (file) => {
                if (file instanceof TFile) void taskReferenceCheckboxWatcher.handleModify(file);
            }),
        );

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
            id: "manage-active-note-events-tasks",
            name: "Manage events and tasks in active note",
            checkCallback: (checking) => {
                const file = this.app.workspace.getActiveFile();
                const available = file instanceof TFile && file.extension === "md";
                if (available && !checking) void openActiveNoteManager(this.app, () => this.settings, this, file);
                return available;
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

        this.addCommand({
            id: "rebuild-scheduled-item-projections",
            name: "Rebuild Task/Event Daily projections",
            callback: () => {
                void this.rebuildProjections();
            },
        });

        this.addCommand({
            id: "repair-orphan-projection-references",
            name: "Repair orphaned Daily projection references",
            checkCallback: (checking) => {
                const summary = this.lastReconciliationSummary;
                const available = Boolean(
                    summary && (summary.orphanTaskReferences.length > 0 || summary.orphanEventReferences.length > 0),
                );
                if (available && !checking) void this.repairOrphanReferences();
                return available;
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

    /**
     * Task 45: recomputes every Task/Event's expected Daily references from canonical truth and
     * reconciles the vault to match, reusing the same write path as every incremental edit. Caches
     * the summary so "Repair orphaned Daily projection references" has something to act on.
     */
    private async rebuildProjections(): Promise<void> {
        new Notice("Rebuilding Task/Event Daily projections…");
        const summary = await runProjectionReconciliation(this.app, this.settings);
        this.lastReconciliationSummary = summary;
        const orphanCount = summary.orphanTaskReferences.length + summary.orphanEventReferences.length;
        const parts = [
            `${summary.tasksReconciled} Task(s) and ${summary.eventsReconciled} Event(s) checked`,
            `${summary.referencesCreated} created, ${summary.referencesRemoved} removed`,
        ];
        if (summary.failedWrites || summary.failedRemovals) {
            parts.push(`${summary.failedWrites + summary.failedRemovals} write(s) failed — rerun to retry`);
        }
        if (orphanCount > 0) parts.push(`${orphanCount} orphaned reference(s) found — run the repair command`);
        if (summary.ambiguousTaskTargets.length + summary.ambiguousEventTargets.length > 0) {
            parts.push(
                `${summary.ambiguousTaskTargets.length + summary.ambiguousEventTargets.length} ambiguous block id(s) skipped`,
            );
        }
        new Notice(parts.join(". "));
        console.info("[Focus Notes] Projection reconciliation summary", summary);
    }

    private async repairOrphanReferences(): Promise<void> {
        const summary = this.lastReconciliationSummary;
        if (!summary) return;
        await repairOrphanProjectionReferences(
            this.app,
            this.settings,
            summary.orphanTaskReferences,
            summary.orphanEventReferences,
        );
        const count = summary.orphanTaskReferences.length + summary.orphanEventReferences.length;
        this.lastReconciliationSummary = null;
        new Notice(`Removed ${count} orphaned Daily projection reference(s).`);
    }
}
