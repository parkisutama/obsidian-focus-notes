import { EngineMode, TimerStatus } from "./types";

/**
 * Pure timer state machine. No DOM, no Obsidian APIs.
 *
 * Why this is separated:
 * - Easier to reason about state transitions in isolation.
 * - Lets the view subscribe via callbacks without owning any timing logic.
 * - Pause-correct: tracks accumulatedMs + a single resumeStartedAt rather
 *   than mutating a startedAt field backwards. This preserves the real
 *   wall-clock start of the session for logging.
 */
export interface StopResult {
    startedAt: Date;
    endedAt: Date;
    elapsedMs: number;
    /** Target duration for countdown sessions; 0 for stopwatch. */
    targetMs: number;
}

export class TimerEngine {
    private mode: EngineMode = "countdown";
    private status: TimerStatus = "idle";

    private originalStartedAt: Date | null = null;
    private resumeStartedAt: Date | null = null;
    private accumulatedMs = 0;
    private targetMs = 0;

    private intervalId: number | null = null;
    private tickCallback: ((displayMs: number) => void) | null = null;
    private completionCallback: (() => void) | null = null;

    /** Configure mode and target. Only allowed when idle. */
    public configure(mode: EngineMode, targetMinutes: number): void {
        if (this.status !== "idle") {
            throw new Error("Cannot reconfigure timer while a session is in progress.");
        }
        this.mode = mode;
        this.targetMs = mode === "countdown" ? Math.max(0, targetMinutes) * 60_000 : 0;
    }

    public start(): void {
        if (this.status === "running") return;
        if (this.originalStartedAt === null) {
            this.originalStartedAt = new Date();
        }
        this.resumeStartedAt = new Date();
        this.status = "running";
        this.intervalId = window.setInterval(() => this.tick(), 250);
    }

    public pause(): void {
        if (this.status !== "running" || !this.resumeStartedAt) return;
        this.accumulatedMs += Date.now() - this.resumeStartedAt.getTime();
        this.resumeStartedAt = null;
        this.status = "paused";
        this.clearInterval();
    }

    public resume(): void {
        if (this.status !== "paused") return;
        this.start();
    }

    /**
     * Finalize the session. Valid from running, paused, or completed states.
     * Returns null when called from idle (nothing to log).
     */
    public stop(): StopResult | null {
        if (this.status === "idle" || !this.originalStartedAt) return null;
        // Capture in-flight elapsed before clearing accumulator.
        const elapsedMs = this.getElapsedMs();
        const result: StopResult = {
            startedAt: this.originalStartedAt,
            endedAt: new Date(),
            elapsedMs,
            targetMs: this.targetMs
        };
        this.reset();
        return result;
    }

    /** Discard the session without producing a result. */
    public reset(): void {
        this.clearInterval();
        this.status = "idle";
        this.accumulatedMs = 0;
        this.originalStartedAt = null;
        this.resumeStartedAt = null;
    }

    public getStatus(): TimerStatus {
        return this.status;
    }

    public getMode(): EngineMode {
        return this.mode;
    }

    /** Returns the value to render: remaining for countdown, elapsed for stopwatch. */
    public getDisplayMs(): number {
        const elapsed = this.getElapsedMs();
        return this.mode === "countdown" ? Math.max(0, this.targetMs - elapsed) : elapsed;
    }

    /** Progress in [0,1] for countdown, or null for stopwatch. */
    public getProgress(): number | null {
        if (this.mode !== "countdown" || this.targetMs <= 0) return null;
        return Math.min(1, Math.max(0, this.getElapsedMs() / this.targetMs));
    }

    public onTick(callback: (displayMs: number) => void): void {
        this.tickCallback = callback;
    }

    public onComplete(callback: () => void): void {
        this.completionCallback = callback;
    }

    private tick(): void {
        const elapsed = this.getElapsedMs();
        if (this.tickCallback) this.tickCallback(this.getDisplayMs());
        if (this.mode === "countdown" && elapsed >= this.targetMs) {
            // Freeze accumulator at target so subsequent reads are stable.
            this.accumulatedMs = this.targetMs;
            this.resumeStartedAt = null;
            this.status = "completed";
            this.clearInterval();
            if (this.completionCallback) this.completionCallback();
        }
    }

    private getElapsedMs(): number {
        if (this.status === "running" && this.resumeStartedAt) {
            return this.accumulatedMs + (Date.now() - this.resumeStartedAt.getTime());
        }
        return this.accumulatedMs;
    }

    private clearInterval(): void {
        if (this.intervalId !== null) {
            window.clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}
