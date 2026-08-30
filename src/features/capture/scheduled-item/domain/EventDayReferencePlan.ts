export interface EventDayReferenceDiff {
    /** Local day keys (YYYY-MM-DD) that need a new reference written. */
    readonly createDays: readonly string[];
    /** Local day keys whose existing reference is no longer touched and should be removed. */
    readonly removeDays: readonly string[];
}

/**
 * Diffs the previous and next touched-day sets for one Event so only the days that actually
 * changed get written or removed — never a full rewrite, and never the canonical day itself
 * (its own canonical block already represents that day, per the spec's Daily projection rules).
 */
export function planEventDayReferences(
    previousTouchedDays: readonly string[],
    nextTouchedDays: readonly string[],
    canonicalDayKey: string,
): EventDayReferenceDiff {
    const previous = new Set(previousTouchedDays.filter((day) => day !== canonicalDayKey));
    const next = new Set(nextTouchedDays.filter((day) => day !== canonicalDayKey));
    return {
        createDays: [...next].filter((day) => !previous.has(day)),
        removeDays: [...previous].filter((day) => !next.has(day)),
    };
}
