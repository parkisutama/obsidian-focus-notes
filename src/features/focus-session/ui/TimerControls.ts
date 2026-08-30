import { type App, Menu, Notice, setIcon } from "obsidian";
import { FileSuggest } from "../../../infrastructure/obsidian/suggestions/Suggesters";
import type { FocusNotesSettings } from "../../settings/domain/FocusNotesSettings";
import { CircularDisplay } from "./CircularDisplay";
import { type DisplayMode, toEngineMode } from "../domain/Timer";
import type { TimerEngine } from "../domain/TimerEngine";

export interface TimerControlsOptions {
    app: App;
    engine: TimerEngine;
    getSettings: () => FocusNotesSettings;
    saveSettings: () => Promise<void>;
    initialMode: DisplayMode;
    onStopAndLog: () => void;
}

/**
 * The Timer sidebar's mode selector, focus-on input, circular display,
 * duration row, and Discard/Start-Pause/Stop-and-log action buttons. Owns
 * currentMode (never persisted directly — applyMode writes it to
 * settings.lastMode) and reads/writes the TimerEngine it's given, but has no
 * knowledge of logging, targets, or recent entries.
 */
export class TimerControls {
    private display!: CircularDisplay;
    private modeButton!: HTMLButtonElement;
    private focusInput!: HTMLInputElement;
    private durationRow!: HTMLElement;
    private durationInput!: HTMLInputElement;
    private resetBtn!: HTMLButtonElement;
    private primaryBtn!: HTMLButtonElement;
    private stopBtn!: HTMLButtonElement;

    private currentMode: DisplayMode;

    constructor(private options: TimerControlsOptions) {
        this.currentMode = options.initialMode;
    }

    render(parent: HTMLElement): void {
        this.renderModeMenu(parent);
        this.renderFocusInput(parent);
        this.display = new CircularDisplay(parent);
        this.renderDurationRow(parent);
        this.renderActions(parent);
        this.applyMode(this.currentMode); // sets default duration + display
        this.refreshDisplay();
    }

    getCurrentMode(): DisplayMode {
        return this.currentMode;
    }

    getFocusInputValue(): string {
        return this.focusInput.value;
    }

    setFocusInputValue(value: string): void {
        this.focusInput.value = value;
    }

    parseMinutes(): number {
        const raw = parseFloat(this.durationInput.value);
        if (!Number.isFinite(raw) || raw <= 0) {
            const fallback =
                this.currentMode === "pomodoro"
                    ? this.options.getSettings().pomodoroMinutes
                    : this.options.getSettings().timerMinutes;
            this.durationInput.value = String(fallback);
            return fallback;
        }
        return raw;
    }

    refreshDisplay(): void {
        const status = this.options.engine.getStatus();
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
            displayMs = this.options.engine.getDisplayMs();
            progress = this.options.engine.getProgress();
        }

        this.display.update(this.formatTime(displayMs), this.statusLabel(status), progress);
    }

    refreshActions(): void {
        const status = this.options.engine.getStatus();
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
        new FileSuggest(this.options.app, this.focusInput);
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
            if (this.options.engine.getStatus() === "idle") this.refreshDisplay();
        });
    }

    private renderActions(parent: HTMLElement): void {
        const row = parent.createDiv({ cls: "focus-notes-actions" });
        this.resetBtn = this.createIconButton(row, "rotate-ccw", "Discard", "focus-notes-btn-secondary");
        this.primaryBtn = this.createIconButton(row, "play", "Start", "focus-notes-btn-primary");
        this.stopBtn = this.createIconButton(row, "square", "Stop & log", "focus-notes-btn-secondary");

        this.resetBtn.addEventListener("click", () => this.handleReset());
        this.primaryBtn.addEventListener("click", () => this.handlePrimary());
        this.stopBtn.addEventListener("click", () => this.options.onStopAndLog());
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
        if (this.options.engine.getStatus() !== "idle") {
            new Notice("Stop the current session before switching modes.");
            return;
        }
        this.currentMode = mode;
        // Persist so the panel reopens to the same mode.
        this.options.getSettings().lastMode = mode;
        void this.options.saveSettings();
        this.modeButton.setText(this.modeLabel(mode));
        // Stopwatch hides duration; countdown variants show it with mode-appropriate default.
        const settings = this.options.getSettings();
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
        const { engine } = this.options;
        const status = engine.getStatus();
        if (status === "idle") {
            const minutes = this.parseMinutes();
            try {
                engine.configure(toEngineMode(this.currentMode), minutes);
            } catch (err) {
                new Notice(err instanceof Error ? err.message : String(err));
                return;
            }
            engine.start();
        } else if (status === "running") {
            engine.pause();
        } else if (status === "paused") {
            engine.resume();
        }
        // status === "completed": primary becomes a no-op until user logs/discards.
        this.refreshActions();
        this.refreshDisplay();
    }

    private handleReset(): void {
        if (this.options.engine.getStatus() === "idle") return;
        this.options.engine.reset();
        this.refreshActions();
        this.refreshDisplay();
        new Notice("Session discarded.");
    }

    // ---------------------------------------------------------------------
    // Small utilities
    // ---------------------------------------------------------------------

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
