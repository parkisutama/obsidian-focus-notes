import { type App, Notice } from "obsidian";
import { EventTaskWriter } from "../../../infrastructure/obsidian/capture/EventTaskWriter.ts";
import type { TargetResolver } from "../../../infrastructure/obsidian/capture/TargetResolver";
import {
    type WriteCanonicalFocusSessionResult,
    writeCanonicalFocusSession,
} from "../../../infrastructure/obsidian/focus-session/CanonicalFocusSessionWriter.ts";
import { runFocusSessionWeekProjection } from "../../../infrastructure/obsidian/focus-session/FocusSessionWeekProjectionRuntime.ts";
import type { NoteWriter } from "../../../infrastructure/obsidian/focus-session/NoteWriter";
import type { FocusTarget } from "../../capture/domain/CaptureTarget";
import { formatLocalDateTime } from "../../capture/domain/EventTaskFormState.ts";
import type { EmotionCategory, StressLevel } from "../../reflection/domain/Wellbeing.ts";
import type { FocusNotesSettings } from "../../settings/domain/FocusNotesSettings";
import { createFocusSessionId } from "../domain/FocusSessionLine.ts";
import type { FocusSessionOwner } from "../domain/OwnedFocusSession.ts";
import type { SessionRecord } from "../domain/SessionRecord";
import type { DisplayMode } from "../domain/Timer";
import type { TimerEngine } from "../domain/TimerEngine";
import { LogModal } from "./LogModal";

export interface TimerLogWorkflowOptions {
    app: App;
    engine: TimerEngine;
    getSettings: () => FocusNotesSettings;
    buildWriter: () => NoteWriter;
    buildResolver: () => TargetResolver;
    getCurrentMode: () => DisplayMode;
    getFocusInput: () => string;
    setFocusInput: (value: string) => void;
    getPlannedMinutes: () => number;
    /** The resolved Event/Task(+timebox) owner from the last successful start, or null if unassigned/legacy. */
    getCurrentOwner: () => FocusSessionOwner | null;
    /** Called after any engine state transition so controls/display stay in sync. */
    onSessionStateChanged: () => void;
    onRecentChanged: () => void;
    /** Called once a stopped session's lifecycle is fully over (logged, cancelled, or too short), so the next session starts with a clean owner/purpose selection. */
    onSessionEnded: () => void;
}

/**
 * The Timer sidebar's completion/logging concern: stopping a session (by
 * hand or on countdown completion), opening LogModal, building the
 * SessionRecord, and writing it. Owns none of the engine's state — it only
 * calls TimerEngine.stop() and reacts to the result.
 */
export class TimerLogWorkflow {
    constructor(private options: TimerLogWorkflowOptions) {}

    async handleStopAndLog(): Promise<void> {
        const { engine } = this.options;
        const status = engine.getStatus();
        if (status === "idle") return;
        const result = engine.stop();
        this.options.onSessionStateChanged();
        if (!result) return;
        const elapsedSeconds = Math.round(result.elapsedMs / 1000);
        if (elapsedSeconds < 1) {
            new Notice("Session too short to log.");
            this.options.onSessionEnded();
            return;
        }
        await this.openLogModal(result.startedAt, result.endedAt, elapsedSeconds);
        this.options.onSessionEnded();
    }

    handleComplete(): void {
        if (this.options.getSettings().playSound) this.beep();
        new Notice("Focus session complete.");
        this.options.onSessionStateChanged();
        if (this.options.getSettings().autoOpenLogModal) {
            void this.handleStopAndLog();
        }
    }

    private async openLogModal(startTime: Date, endTime: Date, durationSeconds: number): Promise<void> {
        const {
            app,
            buildResolver,
            buildWriter,
            getCurrentMode,
            getFocusInput,
            setFocusInput,
            getPlannedMinutes,
            getSettings,
        } = this.options;
        const resolver = buildResolver();
        const resolvedTarget = resolver.resolve(this.activeTarget(), endTime);
        const currentMode = getCurrentMode();
        return new Promise((resolve) => {
            const modal = new LogModal(
                app,
                {
                    mode: currentMode,
                    startTime,
                    endTime,
                    durationSeconds,
                    initialTask: getFocusInput(),
                    resolvedTarget,
                    getContextSources: () => getSettings().inbox.contextSources,
                },
                async (result) => {
                    if (!result) {
                        resolve();
                        return;
                    }
                    try {
                        const owner = this.options.getCurrentOwner();
                        const canonicalLink = owner
                            ? await this.recordCanonicalFocusSession(
                                  owner,
                                  startTime,
                                  endTime,
                                  durationSeconds,
                                  currentMode,
                                  {
                                      stressLevel: result.stressLevel,
                                      emotionCategory: result.emotionCategory,
                                      emotionKey: result.moodKey,
                                      notes: result.notes,
                                  },
                              )
                            : "";
                        const record: SessionRecord = {
                            mode: currentMode,
                            startTime,
                            endTime,
                            durationSeconds,
                            plannedSeconds: currentMode === "stopwatch" ? null : getPlannedMinutes() * 60,
                            task: result.task,
                            notes: result.notes,
                            stressLevel: result.stressLevel,
                            emotionCategory: result.emotionCategory,
                            moodKey: result.moodKey,
                            links: "",
                            canonicalLink,
                        };
                        await buildWriter().writeSession(record, resolvedTarget);
                        new Notice("Session logged.");
                        // Clear the focus input so the next session starts fresh.
                        setFocusInput("");
                        this.options.onRecentChanged();
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

    /**
     * Writes the canonical Focus Session child line before the daily log, so the log's
     * {{canonicalLink}} token can point at it. `sessionId` is minted once here and reused by the
     * retry button, so retrying after an orphaned owner (e.g. the Task was renamed mid-session)
     * never risks a duplicate history entry once the link resolves.
     */
    private async recordCanonicalFocusSession(
        owner: FocusSessionOwner,
        startTime: Date,
        endTime: Date,
        durationSeconds: number,
        mode: DisplayMode,
        reflection: {
            stressLevel: StressLevel | null;
            emotionCategory: EmotionCategory | null;
            emotionKey: string | null;
            notes: string;
        },
    ): Promise<string> {
        const sessionId = createFocusSessionId();
        const fields = {
            actualStart: formatLocalDateTime(startTime),
            actualEnd: formatLocalDateTime(endTime),
            durationSeconds,
            mode,
            stressLevel: reflection.stressLevel,
            emotionCategory: reflection.emotionCategory,
            emotionKey: reflection.emotionKey,
            notes: reflection.notes,
        };
        const attempt = (): Promise<WriteCanonicalFocusSessionResult> =>
            writeCanonicalFocusSession(this.options.app, owner, sessionId, fields);
        const result = await attempt();
        if (result.status === "orphan") {
            this.notifyOrphanedCanonicalWrite(attempt, owner, startTime, endTime);
            return "";
        }
        if (result.status === "written") this.projectOwnedSessionWeekly(owner, startTime, endTime);
        return `[[${result.filePath}#^${sessionId}]]`;
    }

    private notifyOrphanedCanonicalWrite(
        retry: () => Promise<WriteCanonicalFocusSessionResult>,
        owner: FocusSessionOwner,
        startTime: Date,
        endTime: Date,
    ): void {
        const notice = new Notice(
            createFragment((frag) => {
                frag.createSpan({
                    text: "Session logged, but its Task/Event could not be found to link it. ",
                });
                const button = frag.createEl("button", { text: "Retry" });
                button.addEventListener("click", () => {
                    notice.hide();
                    void retry().then((result) => {
                        if (result.status === "orphan") {
                            this.notifyOrphanedCanonicalWrite(retry, owner, startTime, endTime);
                            return;
                        }
                        new Notice("Focus Session linked to its Task/Event.");
                        if (result.status === "written") this.projectOwnedSessionWeekly(owner, startTime, endTime);
                    });
                });
            }),
            0,
        );
    }

    /**
     * Fire-and-forget: a failed Weekly cross-reference is logged, not surfaced, since the
     * canonical Focus Session record (the source of truth) is already safely written by the
     * time this runs. See FocusSessionWeekProjectionRuntime for the write-only rationale.
     */
    private projectOwnedSessionWeekly(owner: FocusSessionOwner, startTime: Date, endTime: Date): void {
        const settings = this.options.getSettings();
        const writer = new EventTaskWriter(this.options.app, settings.eventTask, () => settings);
        void runFocusSessionWeekProjection(this.options.app, settings, writer, {
            owner,
            start: startTime,
            end: endTime,
        });
    }

    private activeTarget(): FocusTarget {
        return this.options.buildResolver().getDefaultTarget();
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
