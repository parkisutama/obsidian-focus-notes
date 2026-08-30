export interface FocusUtilizationSummary {
    plannedSeconds: number;
    focusedSeconds: number;
    sessionCount: number;
}

/** Aggregates actual Focus Sessions against one planned interval — a timebox's or Event's own duration. */
export function summarizeFocusUtilization(
    plannedSeconds: number,
    sessions: ReadonlyArray<{ durationSeconds: number }>,
): FocusUtilizationSummary {
    return {
        plannedSeconds,
        focusedSeconds: sessions.reduce((sum, session) => sum + session.durationSeconds, 0),
        sessionCount: sessions.length,
    };
}
