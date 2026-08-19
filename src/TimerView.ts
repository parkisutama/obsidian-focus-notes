import { ItemView, Notice, type WorkspaceLeaf, setIcon, debounce, MarkdownRenderer, Menu } from "obsidian";
import { TimerEngine } from "./TimerEngine";
import { CircularDisplay } from "./CircularDisplay";
import { LogModal } from "./LogModal";
import type { NoteWriter } from "./NoteWriter";
import type { TargetResolver } from "./TargetResolver";
import type { RecentEntriesReader } from "./RecentEntriesReader";
import {
    type DisplayMode,
    type FocusNotesSettings,
    type FocusTarget,
    type InsertPosition,
    type SessionRecord,
    toEngineMode,
} from "./types";
import { FileSuggest, HeadingSuggest } from "./Suggesters";
import { isTFile } from "./utils";

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
    private targetFileInput!: HTMLInputElement;
    private targetResolvedPreviewEl!: HTMLElement;
    private targetHeadingInput!: HTMLInputElement;
    private targetPositionSelect!: HTMLSelectElement;
    private targetGroupToggle!: HTMLInputElement;
    private targetGroupLevelSelect!: HTMLSelectElement;
    private recentList!: HTMLElement;
    private recentTitle!: HTMLElement;

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
        this.engine.onTick(() => this.refreshDisplay());
        this.engine.onComplete(() => this.handleComplete());
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
        this.renderTargetSection(wrap);
        this.renderRecentSection(wrap);

        this.applyMode(this.currentMode); // sets default duration + display
        this.refreshDisplay();
        await this.refreshRecent();
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
        this.stopBtn.addEventListener("click", () => this.handleStopAndLog());
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

    private renderTargetSection(parent: HTMLElement): void {
        const details = parent.createEl("details", { cls: "focus-notes-section" });
        details.setAttribute("open", "");
        const summary = details.createEl("summary");
        summary.createEl("span", { text: "Log target", cls: "focus-notes-section-title" });

        const body = details.createDiv({ cls: "focus-notes-section-body" });

        // Why "input" instead of "change":
        //   "change" fires only on blur. When AbstractInputSuggest sets the
        //   value programmatically (user picked from the dropdown), it
        //   dispatches "input", not "change", so a "change"-only listener
        //   misses suggester selections entirely. Switching to "input" with
        //   a 300ms debounce makes the suggester picks persist immediately
        //   while keeping per-keystroke saves cheap.
        const persistTargetEdit = debounce(
            () => {
                void this.saveSettings();
                void this.refreshRecent();
            },
            300,
            true,
        );

        // File row
        const fileRow = body.createDiv({ cls: "focus-notes-target-row" });
        fileRow.createEl("label", { text: "File", cls: "focus-notes-target-label" });
        const fileCell = fileRow.createDiv({ cls: "focus-notes-target-cell" });
        this.targetFileInput = fileCell.createEl("input", {
            type: "text",
            cls: "focus-notes-target-input",
            attr: { placeholder: "Path or template, e.g. Daily/{{date:YYYY-MM-DD}}.md" },
        });
        new FileSuggest(this.app, this.targetFileInput);
        this.targetFileInput.addEventListener("input", () => {
            this.getSettings().liveTarget.file = this.targetFileInput.value.trim();
            this.updateTargetResolvedPreview();
            persistTargetEdit();
        });
        this.targetResolvedPreviewEl = fileCell.createDiv({
            cls: "focus-notes-target-resolved",
        });

        // Heading row — uses the file-aware HeadingSuggest so it autocompletes
        // against whatever file path is currently typed in the file input.
        // The thunk re-reads liveTarget on every suggestion query, so keystrokes
        // in the file input propagate to the heading suggester immediately
        // (because we update liveTarget.file on each "input" event above).
        const headingRow = body.createDiv({ cls: "focus-notes-target-row" });
        headingRow.createEl("label", { text: "Heading", cls: "focus-notes-target-label" });
        this.targetHeadingInput = headingRow.createEl("input", {
            type: "text",
            cls: "focus-notes-target-input",
            attr: { placeholder: "(empty = end of file)" },
        });
        new HeadingSuggest(
            this.app,
            this.targetHeadingInput,
            () => this.buildResolver().resolve(this.activeTarget()).file,
        );
        this.targetHeadingInput.addEventListener("input", () => {
            this.getSettings().liveTarget.heading = this.targetHeadingInput.value.trim();
            persistTargetEdit();
        });

        // Position row — a <select> only fires "change" (no per-character
        // editing to debounce), so the simpler immediate save is fine here.
        const posRow = body.createDiv({ cls: "focus-notes-target-row" });
        posRow.createEl("label", { text: "Position", cls: "focus-notes-target-label" });
        this.targetPositionSelect = posRow.createEl("select", {
            cls: "focus-notes-target-input",
        });
        this.targetPositionSelect.createEl("option", { text: "End (newest at bottom)", value: "end" });
        this.targetPositionSelect.createEl("option", { text: "Start (newest at top)", value: "start" });
        this.targetPositionSelect.addEventListener("change", () => {
            this.getSettings().liveTarget.position = this.targetPositionSelect.value as InsertPosition;
            void this.saveSettings();
            void this.refreshRecent();
        });

        // Group-by-date toggle — affects both writer and reader. Lives next to
        // the target picker because it's a per-target structural choice (the
        // user might group by date in their daily note but not in a dedicated
        // log file, or vice versa).
        const groupRow = body.createDiv({ cls: "focus-notes-target-row" });
        groupRow.createEl("label", { text: "Group", cls: "focus-notes-target-label" });
        const groupCell = groupRow.createDiv({ cls: "focus-notes-target-input focus-notes-group-cell" });
        const groupToggle = groupCell.createEl("input", { type: "checkbox" });
        groupToggle.addEventListener("change", () => {
            this.getSettings().groupByDate = groupToggle.checked;
            this.targetGroupLevelSelect.disabled = !groupToggle.checked;
            void this.saveSettings();
            void this.refreshRecent();
        });
        groupCell.createSpan({ text: "by date", cls: "focus-notes-group-label" });
        this.targetGroupLevelSelect = groupCell.createEl("select", {
            cls: "focus-notes-group-level",
        });
        for (const lvl of [2, 3, 4] as const) {
            this.targetGroupLevelSelect.createEl("option", {
                text: `H${lvl}`,
                value: String(lvl),
            });
        }
        this.targetGroupLevelSelect.addEventListener("change", () => {
            const v = parseInt(this.targetGroupLevelSelect.value, 10);
            if (v === 2 || v === 3 || v === 4) {
                this.getSettings().dateSubHeadingLevel = v;
                void this.saveSettings();
            }
        });
        this.targetGroupToggle = groupToggle;

        // Reset to default clears live overrides so later Settings changes
        // keep flowing into this sidebar target.
        const resetLink = body.createEl("a", {
            text: "Reset to default",
            cls: "focus-notes-target-reset",
            href: "#",
        });
        resetLink.addEventListener("click", (evt) => {
            evt.preventDefault();
            this.getSettings().liveTarget = {
                file: "",
                heading: "",
                position: this.getSettings().captureFocusSession.position,
            };
            void this.saveSettings();
            this.syncTargetInputs();
            void this.refreshRecent();
        });

        this.syncTargetInputs();

        // Refresh the recent feed when the active target file is modified
        // outside this view (manual edits, sync, other plugins). The check
        // resolves the active target lazily so token changes don't matter.
        this.registerEvent(
            this.app.vault.on("modify", (file) => {
                if (!isTFile(file)) return;
                const active = this.buildResolver().resolve(this.activeTarget());
                if (file.path === active.file) {
                    void this.refreshRecent();
                }
            }),
        );
    }

    private renderRecentSection(parent: HTMLElement): void {
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
            void this.refreshRecent();
        });

        this.recentList = details.createDiv({ cls: "focus-notes-recent-list" });
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

    /**
     * The "what target would write right now" view — pulls from
     * resolver.getActiveTarget() so live overrides win and empty fields fall
     * through to defaults. Use this everywhere instead of a transient field.
     */
    private activeTarget(): FocusTarget {
        return this.buildResolver().getActiveTarget();
    }

    private syncTargetInputs(): void {
        const active = this.activeTarget();
        this.targetFileInput.value = active.file;
        this.targetHeadingInput.value = active.heading;
        this.targetPositionSelect.value = active.position;
        const s = this.getSettings();
        this.targetGroupToggle.checked = s.groupByDate;
        this.targetGroupLevelSelect.value = String(s.dateSubHeadingLevel);
        this.targetGroupLevelSelect.disabled = !s.groupByDate;
        this.updateTargetResolvedPreview();
    }

    private updateTargetResolvedPreview(): void {
        if (!this.targetResolvedPreviewEl) return;
        const resolved = this.buildResolver().resolve(this.activeTarget());
        this.targetResolvedPreviewEl.setText(resolved.file ? `Today: ${resolved.file}` : "");
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

    private async handleStopAndLog(): Promise<void> {
        const status = this.engine.getStatus();
        if (status === "idle") return;
        const result = this.engine.stop();
        this.refreshActions();
        this.refreshDisplay();
        if (!result) return;
        const elapsedSeconds = Math.round(result.elapsedMs / 1000);
        if (elapsedSeconds < 1) {
            new Notice("Session too short to log.");
            return;
        }
        await this.openLogModal(result.startedAt, result.endedAt, elapsedSeconds);
    }

    private handleComplete(): void {
        if (this.getSettings().playSound) this.beep();
        new Notice("Focus session complete.");
        this.refreshActions();
        this.refreshDisplay();
        if (this.getSettings().autoOpenLogModal) {
            void this.handleStopAndLog();
        }
    }

    private async openLogModal(startTime: Date, endTime: Date, durationSeconds: number): Promise<void> {
        const resolver = this.buildResolver();
        const resolvedTarget = resolver.resolve(this.activeTarget(), endTime);
        return new Promise((resolve) => {
            const modal = new LogModal(
                this.app,
                {
                    mode: this.currentMode,
                    startTime,
                    endTime,
                    durationSeconds,
                    initialTask: this.focusInput.value,
                    resolvedTarget,
                },
                async (result) => {
                    if (!result) {
                        resolve();
                        return;
                    }
                    try {
                        const record: SessionRecord = {
                            mode: this.currentMode,
                            startTime,
                            endTime,
                            durationSeconds,
                            plannedSeconds: this.currentMode === "stopwatch" ? null : this.parseMinutes() * 60,
                            task: result.task,
                            notes: result.notes,
                            stressLevel: result.stressLevel,
                            emotionCategory: result.emotionCategory,
                            moodKey: result.moodKey,
                            links: result.links,
                        };
                        await this.buildWriter().writeSession(record, resolvedTarget);
                        new Notice("Session logged.");
                        // Clear the focus input so the next session starts fresh.
                        this.focusInput.value = "";
                        await this.refreshRecent();
                    } catch (err) {
                        const msg = err instanceof Error ? err.message : String(err);
                        new Notice(`Log failed: ${msg}`);
                        console.error("[Focus Notes] write failed", err);
                    }
                    resolve();
                },
            );
            modal.open();
        });
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

    private async refreshRecent(): Promise<void> {
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
            // `this` (Component) ties cleanup to the view's lifecycle.
            void MarkdownRenderer.render(this.app, entry.text, item, resolved.file, this);
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

    /**
     * Brief tone via WebAudio. Wrapped because mobile Safari may refuse
     * AudioContext outside a user gesture; a failed beep should never
     * break the timer.
     */
    private beep(): void {
        try {
            const Ctor =
                window.AudioContext ||
                (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            const ctx = new Ctor();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.001, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
            osc.start();
            osc.stop(ctx.currentTime + 0.6);
            osc.onended = () => ctx.close();
        } catch (err) {
            console.warn("[Focus Notes] beep failed", err);
        }
    }
}
