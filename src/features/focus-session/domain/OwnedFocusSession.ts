import type { DisplayMode } from "./Timer.ts";

export type FocusSessionOwner = { kind: "event"; itemId: string } | { kind: "task"; itemId: string };

export interface OwnedFocusSession {
    sessionId: string;
    owner: FocusSessionOwner;
    /** Local "YYYY-MM-DD HH:mm" — actual execution, never the planned timebox interval. */
    actualStart: string;
    actualEnd: string;
    durationSeconds: number;
    /** Planned countdown length in seconds; null for stopwatch. Independent of the timebox's own planned interval. */
    plannedSeconds: number | null;
    mode: DisplayMode;
    notes: string;
}

export type BuildFocusSessionOwnerResult = { status: "valid"; owner: FocusSessionOwner };

/**
 * Validates ownership at the boundary where untyped input (a UI selection, a parsed line) becomes
 * a FocusSessionOwner — the one place the invariant needs a runtime check instead of relying on
 * the type system alone.
 */
export function buildFocusSessionOwner(kind: "task" | "event", itemId: string): BuildFocusSessionOwnerResult {
    return { status: "valid", owner: { kind, itemId } };
}
