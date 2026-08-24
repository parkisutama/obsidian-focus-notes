import { ItemView, Notice, type WorkspaceLeaf, setIcon, Menu } from "obsidian";
import { TimerEngine } from "./features/focus-session/domain/TimerEngine";
import { CircularDisplay } from "./features/focus-session/ui/CircularDisplay";
import { TimerLogWorkflow } from "./features/focus-session/ui/TimerLogWorkflow";
import { TimerRecentEntries } from "./features/focus-session/ui/TimerRecentEntries";
import { TimerTargetEditor } from "./features/focus-session/ui/TimerTargetEditor";
import type { NoteWriter } from "./NoteWriter";
import type { TargetResolver } from "./TargetResolver";
import type { RecentEntriesReader } from "./RecentEntriesReader";
import { type DisplayMode, toEngineMode } from "./features/focus-session/domain/Timer";
import type { FocusNotesSettings } from "./features/settings/domain/FocusNotesSettings";
import { FileSuggest } from "./infrastructure/obsidian/Suggesters";

export const VIEW_TYPE_FOCUS_NOTES = "focus-notes-view";

/**
 * The full Focus Notes sidebar.
 *
 * Composition:
 *   - Mode selector (Pomodoro / Timer / Stopwatch)
 *   - Focus-on text input (optional, pre-fills the modal)
 *   - Circular display (SVG)
 *   - Three icon buttons (reset, play/pause, stop & log)
 *   - Collapsible target editor (file/heading/position)
 *   - Collapsible recent-entries panel
 *
 * State ownership rules:
 *   - The view owns currentMode, the focus-on text, and the per-session
 *     target override. None of these are persisted to settings.
 *   - The TimerEngine owns timing state.
 *   - NoteWriter is constructed per write so it sees current settings.
 *   - The target shown in the sidebar is a *template* (may contain {{date}});
 *     it is resolved through TargetResolver only at write/read time.
 */
export class TimerView extends ItemView {
    private engine: TimerEngine;
    private display!: CircularDisplay;

    // UI elements that need updating across state changes
    private modeButton!: HTMLButtonElement;
    private focusInput!: HTMLInputElement;
    private durationRow!: HTMLElement;
    private durationInput!: HTMLInputElement;
    private resetBtn!: HTMLButtonElement;
    private primaryBtn!: HTMLButtonElement;
    private stopBtn!: HTMLButtonElement;
    private targetEditor!: TimerTargetEditor;
    private recentEntries!: TimerRecentEntries;
    private logWorkflow: TimerLogWorkflow;

    private currentMode: DisplayMode = "pomodoro";

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
        this.logWorkflow = new TimerLogWorkflow({
            app: this.app,
            engine: this.engine,
            getSettings: this.getSettings,
            buildWriter: this.buildWriter,
            buildResolver: this.buildResolver,
            getCurrentMode: () => this.currentMode,
            getFocusInput: () => this.focusInput.value,
            setFocusInput: (value) => {
                this.focusInput.value = value;
            },
            getPlannedMinutes: () => this.parseMinutes(),
            onSessionStateChanged: () => {
                this.refreshActions();
                this.refreshDisplay();
            },
            onRecentChanged: () => void this.recentEntries.refresh(),
        });
        this.engine.onTick(() => this.refreshDisplay());
        this.engine.onComplete(() => this.logWorkflow.handleComplete());
        // Re-seed lastMode from settings so the panel reopens where the user
        // left off. Falls back to pomodoro for never-touched installs.
        this.currentMode = this.getSettings().lastMode || "pomodoro";
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

        this.renderModeMenu(wrap);
        this.renderFocusInput(wrap);
        this.display = new CircularDisplay(wrap);
        this.renderDurationRow(wrap);
        this.renderActions(wrap);
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

        this.applyMode(this.currentMode); // sets default duration + display
        this.refreshDisplay();
        await this.recentEntries.refresh();
    }

    async onClose(): Promise<void> {
        this.engine.reset();
    }

    // ---------------------------------------------------------------------
    // Render helpers
    // ---------------------------------------------------------------------

    private renderModeMenu(parent: HTMLElement): void {
        const row = parent.createDiv({ cls: "focus-notes-mode-row" });
        this.modeButton = row.createEl("button", {
            cls: "focus-notes-mode-button",
            attr: {
                "aria-label": "Timer mode",
                "aria-haspopup": "menu",
                title: "Timer mode",
            },
        });
        this.modeButton.addEventListener("click", () => {
            if (this.modeButton.disabled) return;
            this.showModeMenu();
        });
    }

    private showModeMenu(): void {
        const menu = new Menu();
        const modes: Array<[DisplayMode, string]> = [
            ["pomodoro", "Pomodoro"],
            ["timer", "Timer"],
            ["stopwatch", "Stopwatch"],
        ];
        for (const [mode, label] of modes) {
            menu.addItem((item) => {
                item.setTitle(label)
                    .setChecked(mode === this.currentMode)
                    .onClick(() => this.applyMode(mode));
            });
        }
        const rect = this.modeButton.getBoundingClientRect();
        menu.showAtPosition({
            x: rect.left,
            y: rect.bottom + 4,
            width: rect.width,
        });
    }

    private renderFocusInput(parent: HTMLElement): void {
        const row = parent.createDiv({ cls: "focus-notes-focus-row" });
        this.focusInput = row.createEl("input", {
            type: "text",
            cls: "focus-notes-focus-input",
            attr: { placeholder: "What are you doing?" },
        });
        // FileSuggest mirrors the modal's "What are you doing?" field — same
        // input type in both places means the user doesn't have to remember
        // which surface gives them link completion. Auto-wrap on selection
        // so a picked path becomes [[FileName]] instead of a raw path.
        new FileSuggest(this.app, this.focusInput);
        this.focusInput.addEventListener("input", () => {
            const value = this.focusInput.value;
            if (/^[^\s[]+\.md$/.test(value)) {
                const stem = value.replace(/\.md$/, "");
                this.focusInput.value = `[[${stem}]]`;
            }
        });
    }

    private renderDurationRow(parent: HTMLElement): void {
        this.durationRow = parent.createDiv({ cls: "focus-notes-duration-row" });
        const control = this.durationRow.createDiv({ cls: "focus-notes-duration-control" });
        this.durationInput = control.createEl("input", {
            type: "number",
            cls: "focus-notes-duration-input",
            attr: { min: "1", max: "600", step: "1" },
        });
        control.createEl("span", { text: "min", cls: "focus-notes-duration-suffix" });
        // Reflect duration changes into the display while idle so the user
        // sees the planned time before pressing start.
        this.durationInput.addEventListener("input", () => {
            if (this.engine.getStatus() === "idle") this.refreshDisplay();
        });
    }

    private renderActions(parent: HTMLElement): void {
        const row = parent.createDiv({ cls: "focus-notes-actions" });
        this.resetBtn = this.createIconButton(row, "rotate-ccw", "Discard", "focus-notes-btn-secondary");
        this.primaryBtn = this.createIconButton(row, "play", "Start", "focus-notes-btn-primary");
        this.stopBtn = this.createIconButton(row, "square", "Stop & log", "focus-notes-btn-secondary");

        this.resetBtn.addEventListener("click", () => this.handleReset());
        this.primaryBtn.addEventListener("click", () => this.handlePrimary());
        this.stopBtn.addEventListener("click", () => void this.logWorkflow.handleStopAndLog());
    }

    private createIconButton(
        parent: HTMLElement,
        icon: string,
        ariaLabel: string,
        extraCls: string,
    ): HTMLButtonElement {
        const btn = parent.createEl("button", {
            cls: `focus-notes-icon-btn ${extraCls}`,
            attr: { "aria-label": ariaLabel, title: ariaLabel },
        });
        setIcon(btn, icon);
        return btn;
    }

    // ---------------------------------------------------------------------
    // State application
    // ---------------------------------------------------------------------

    private applyMode(mode: DisplayMode): void {
        if (this.engine.getStatus() !== "idle") {
            new Notice("Stop the current session before switching modes.");
            return;
        }
        this.currentMode = mode;
        // Persist so the panel reopens to the same mode.
        this.getSettings().lastMode = mode;
        void this.saveSettings();
        this.modeButton.setText(this.modeLabel(mode));
        // Stopwatch hides duration; countdown variants show it with mode-appropriate default.
        const settings = this.getSettings();
        if (mode === "stopwatch") {
            this.durationRow.style.display = "none";
        } else {
            this.durationRow.style.display = "";
            const def = mode === "pomodoro" ? settings.pomodoroMinutes : settings.timerMinutes;
            this.durationInput.value = String(def);
        }
        this.refreshDisplay();
    }

    // ---------------------------------------------------------------------
    // Action handlers
    // ---------------------------------------------------------------------

    private handlePrimary(): void {
        const status = this.engine.getStatus();
        if (status === "idle") {
            const minutes = this.parseMinutes();
            try {
                this.engine.configure(toEngineMode(this.currentMode), minutes);
            } catch (err) {
                new Notice(err instanceof Error ? err.message : String(err));
                return;
            }
            this.engine.start();
        } else if (status === "running") {
            this.engine.pause();
        } else if (status === "paused") {
            this.engine.resume();
        }
        // status === "completed": primary becomes a no-op until user logs/discards.
        this.refreshActions();
        this.refreshDisplay();
    }

    private handleReset(): void {
        if (this.engine.getStatus() === "idle") return;
        this.engine.reset();
        this.refreshActions();
        this.refreshDisplay();
        new Notice("Session discarded.");
    }

    // ---------------------------------------------------------------------
    // Refresh helpers
    // ---------------------------------------------------------------------

    private refreshDisplay(): void {
        const status = this.engine.getStatus();
        let displayMs: number;
        let progress: number | null;

        if (status === "idle") {
            // Show the prospective duration before the user starts.
            if (this.currentMode === "stopwatch") {
                displayMs = 0;
                progress = null;
            } else {
                displayMs = this.parseMinutes() * 60_000;
                progress = 0;
            }
        } else {
            displayMs = this.engine.getDisplayMs();
            progress = this.engine.getProgress();
        }

        this.display.update(this.formatTime(displayMs), this.statusLabel(status), progress);
    }

    private refreshActions(): void {
        const status = this.engine.getStatus();
        // Primary button icon flips between play and pause.
        const isPaused = status === "paused";
        const isRunning = status === "running";
        setIcon(this.primaryBtn, isRunning ? "pause" : "play");
        this.primaryBtn.setAttribute(
            "aria-label",
            status === "idle" ? "Start" : isRunning ? "Pause" : isPaused ? "Resume" : "Start",
        );
        // Reset and stop are only meaningful when something is in flight.
        const inFlight = status !== "idle";
        this.resetBtn.toggleClass("focus-notes-hidden", !inFlight);
        this.stopBtn.toggleClass("focus-notes-hidden", !inFlight);
        // Lock duration input while running.
        this.durationInput.disabled = inFlight;
        // Lock mode menu while running.
        this.modeButton.disabled = inFlight;
        this.modeButton.toggleClass("focus-notes-mode-locked", inFlight);
    }

    // ---------------------------------------------------------------------
    // Small utilities
    // ---------------------------------------------------------------------

    private parseMinutes(): number {
        const raw = parseFloat(this.durationInput.value);
        if (!Number.isFinite(raw) || raw <= 0) {
            const fallback =
                this.currentMode === "pomodoro" ? this.getSettings().pomodoroMinutes : this.getSettings().timerMinutes;
            this.durationInput.value = String(fallback);
            return fallback;
        }
        return raw;
    }

    private statusLabel(status: string): string {
        if (status === "running") {
            return this.currentMode === "stopwatch" ? "Tracking" : "Focus";
        }
        if (status === "paused") return "Paused";
        if (status === "completed") return "Done";
        // idle:
        if (this.currentMode === "stopwatch") return "Stopwatch";
        if (this.currentMode === "timer") return "Timer";
        return "Focus";
    }

    private modeLabel(mode: DisplayMode): string {
        if (mode === "pomodoro") return "Pomodoro";
        if (mode === "timer") return "Timer";
        return "Stopwatch";
    }

    private formatTime(ms: number): string {
        const totalSec = Math.max(0, Math.floor(ms / 1000));
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        const mm = String(m).padStart(2, "0");
        const ss = String(s).padStart(2, "0");
        return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
    }
}
