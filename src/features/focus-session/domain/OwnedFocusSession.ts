import type { DisplayMode } from "./Timer.ts";

/**
 * Discriminated by construction, per the spec's code style: a Task-owned session cannot exist
 * without a timeboxId, and an Event-owned session cannot carry one. No `as` cast can smuggle an
 * invalid combination past `buildFocusSessionOwner` below.
 */
export type FocusSessionOwner =
    | { kind: "event"; itemId: string; timeboxId: null }
    | { kind: "task"; itemId: string; timeboxId: string };

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

export type BuildFocusSessionOwnerResult =
    | { status: "valid"; owner: FocusSessionOwner }
    | { status: "invalid"; reason: "task-requires-timebox" | "event-forbids-timebox" };

/**
 * Validates ownership at the boundary where untyped input (a UI selection, a parsed line) becomes
 * a FocusSessionOwner — the one place the invariant needs a runtime check instead of relying on
 * the type system alone.
 */
export function buildFocusSessionOwner(
    kind: "task" | "event",
    itemId: string,
    timeboxId: string | null,
): BuildFocusSessionOwnerResult {
    if (kind === "task") {
        return timeboxId
            ? { status: "valid", owner: { kind: "task", itemId, timeboxId } }
            : { status: "invalid", reason: "task-requires-timebox" };
    }
    return timeboxId
        ? { status: "invalid", reason: "event-forbids-timebox" }
        : { status: "valid", owner: { kind: "event", itemId, timeboxId: null } };
}
