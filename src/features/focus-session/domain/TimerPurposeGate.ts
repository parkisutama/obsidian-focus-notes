import type { FocusSessionOwner } from "./OwnedFocusSession.ts";

export type TimerPurposeSelection =
    | { status: "none" }
    | { status: "event"; itemId: string; title: string }
    | { status: "task"; itemId: string; title: string };

export type TimerStartGateResult =
    | { status: "ready"; owner: FocusSessionOwner }
    | { status: "blocked"; reason: "no-purpose" };

/**
 * The one rule Timer must never bypass: a new session cannot start without a resolvable owner,
 * and a Task owner specifically needs a timebox (Task 34's Timebox Manager creates one — Timer
 * itself never invents one silently). An Event owner never needs a timebox.
 */
export function evaluateTimerStartGate(selection: TimerPurposeSelection): TimerStartGateResult {
    if (selection.status === "none") return { status: "blocked", reason: "no-purpose" };
    return { status: "ready", owner: { kind: selection.status, itemId: selection.itemId } };
}
