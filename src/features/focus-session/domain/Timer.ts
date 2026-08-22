export type DisplayMode = "pomodoro" | "timer" | "stopwatch";
export type EngineMode = "countdown" | "stopwatch";
export type TimerStatus = "idle" | "running" | "paused" | "completed";

export function toEngineMode(displayMode: DisplayMode): EngineMode {
    return displayMode === "stopwatch" ? "stopwatch" : "countdown";
}
