import { ItemView, type WorkspaceLeaf } from "obsidian";
import type { FocusNotesSettings } from "../../settings/domain/FocusNotesSettings";
import type { TargetResolver } from "../../../infrastructure/obsidian/capture/TargetResolver";
import type { NoteWriter } from "../../../infrastructure/obsidian/focus-session/NoteWriter";
import type { RecentEntriesReader } from "../../../infrastructure/obsidian/focus-session/RecentEntriesReader";
import { TimerEngine } from "../domain/TimerEngine";
import { TimerControls } from "./TimerControls";
import { TimerLogWorkflow } from "./TimerLogWorkflow";
import { TimerRecentEntries } from "./TimerRecentEntries";
import { TimerTargetEditor } from "./TimerTargetEditor";

export const VIEW_TYPE_FOCUS_NOTES = "focus-notes-view";

/**
 * The full Focus Notes sidebar. Owns only Obsidian ItemView lifecycle and
 * composition; each concern is its own class:
 *   - TimerControls     — mode selector, focus-on input, circular display,
 *                         duration row, and Discard/Start-Pause/Stop buttons.
 *   - TimerTargetEditor — collapsible "Log target" section.
 *   - TimerRecentEntries — collapsible "Recent in section" panel.
 *   - TimerLogWorkflow  — stopping/completing a session, LogModal, and
 *                         writing the SessionRecord.
 *   - TimerEngine       — pure timing state machine, shared by controls and
 *                         the log workflow.
 */
export class TimerView extends ItemView {
    private engine: TimerEngine;
    private controls: TimerControls;
    private logWorkflow: TimerLogWorkflow;
    private targetEditor!: TimerTargetEditor;
    private recentEntries!: TimerRecentEntries;

    constructor(
        leaf: WorkspaceLeaf,
        private getSettings: () => FocusNotesSettings,
        private saveSettings: () => Promise<void>,
        private buildWriter: () => NoteWriter,
        private buildResolver: () => TargetResolver,
        private buildReader: () => RecentEntriesReader,
    ) {
        super(leaf);
        this.engine = new TimerEngine();
        this.controls = new TimerControls({
            app: this.app,
            engine: this.engine,
            getSettings: this.getSettings,
            saveSettings: this.saveSettings,
            // Re-seed lastMode from settings so the panel reopens where the
            // user left off. Falls back to pomodoro for never-touched installs.
            initialMode: this.getSettings().lastMode || "pomodoro",
            onStopAndLog: () => void this.logWorkflow.handleStopAndLog(),
        });
        this.logWorkflow = new TimerLogWorkflow({
            app: this.app,
            engine: this.engine,
            getSettings: this.getSettings,
            buildWriter: this.buildWriter,
            buildResolver: this.buildResolver,
            getCurrentMode: () => this.controls.getCurrentMode(),
            getFocusInput: () => this.controls.getFocusInputValue(),
            setFocusInput: (value) => this.controls.setFocusInputValue(value),
            getPlannedMinutes: () => this.controls.parseMinutes(),
            getCurrentOwner: () => this.controls.getCurrentOwner(),
            onSessionStateChanged: () => {
                this.controls.refreshActions();
                this.controls.refreshDisplay();
            },
            onRecentChanged: () => void this.recentEntries.refresh(),
            onSessionEnded: () => this.controls.clearOwner(),
        });
        this.engine.onTick(() => this.controls.refreshDisplay());
        this.engine.onComplete(() => this.logWorkflow.handleComplete());
    }

    getViewType(): string {
        return VIEW_TYPE_FOCUS_NOTES;
    }
    getDisplayText(): string {
        return "Focus Notes";
    }
    getIcon(): string {
        return "timer";
    }

    async onOpen(): Promise<void> {
        const root = this.containerEl.children[1] as HTMLElement;
        root.empty();
        root.addClass("focus-notes-view");
        const wrap = root.createDiv({ cls: "focus-notes-wrap" });

        this.controls.render(wrap);
        this.targetEditor = new TimerTargetEditor(
            this.app,
            this.getSettings,
            this.saveSettings,
            this.buildResolver,
            () => void this.recentEntries.refresh(),
            (ref) => this.registerEvent(ref),
        );
        this.targetEditor.render(wrap);
        this.recentEntries = new TimerRecentEntries(
            this.app,
            this,
            this.getSettings,
            this.buildResolver,
            this.buildReader,
        );
        this.recentEntries.render(wrap);

        await this.recentEntries.refresh();
    }

    async onClose(): Promise<void> {
        this.engine.reset();
    }
}
