import { planEventDayReferences } from "./EventDayReferencePlan.ts";

export interface EventCanonicalSnapshot {
    canonicalTarget: string;
    canonicalDayKey: string;
    touchedDayKeys: readonly string[];
}

export interface ExistingEventDayReference {
    canonicalTarget: string;
    /** File the reference line actually lives in — needed to repair/remove it. */
    destinationPath: string;
    dayKey: string;
}

export interface EventDayReferenceFix {
    canonicalTarget: string;
    dayKey: string;
}

export interface EventDayReferenceReconciliationResult {
    toCreate: EventDayReferenceFix[];
    toRemove: EventDayReferenceFix[];
    /** Existing references whose canonical Event no longer exists — reported, never auto-removed. */
    orphanReferences: ExistingEventDayReference[];
    /** Canonical targets that appear more than once in `canonicalEvents` — skipped, never guessed. */
    ambiguousTargets: string[];
}

/**
 * Event counterpart to `reconcileTaskDayReferences`: rebuilds the expected touched-day reference
 * set from canonical truth and diffs it against what's actually on disk, reusing Task 32's
 * `planEventDayReferences` diff so a full rebuild and a single edit converge identically.
 */
export function reconcileEventDayReferences(
    canonicalEvents: readonly EventCanonicalSnapshot[],
    existingReferences: readonly ExistingEventDayReference[],
): EventDayReferenceReconciliationResult {
    const targetCounts = new Map<string, number>();
    for (const event of canonicalEvents) {
        targetCounts.set(event.canonicalTarget, (targetCounts.get(event.canonicalTarget) ?? 0) + 1);
    }
    const ambiguousTargets = [...targetCounts.entries()].filter(([, count]) => count > 1).map(([target]) => target);
    const ambiguous = new Set(ambiguousTargets);

    const existingByTarget = new Map<string, ExistingEventDayReference[]>();
    for (const ref of existingReferences) {
        const list = existingByTarget.get(ref.canonicalTarget) ?? [];
        list.push(ref);
        existingByTarget.set(ref.canonicalTarget, list);
    }

    const toCreate: EventDayReferenceFix[] = [];
    const toRemove: EventDayReferenceFix[] = [];
    const canonicalTargets = new Set<string>();

    for (const event of canonicalEvents) {
        canonicalTargets.add(event.canonicalTarget);
        if (ambiguous.has(event.canonicalTarget)) continue;

        const previousDays = (existingByTarget.get(event.canonicalTarget) ?? []).map((ref) => ref.dayKey);
        const diff = planEventDayReferences(previousDays, event.touchedDayKeys, event.canonicalDayKey);
        for (const dayKey of diff.createDays) toCreate.push({ canonicalTarget: event.canonicalTarget, dayKey });
        for (const dayKey of diff.removeDays) toRemove.push({ canonicalTarget: event.canonicalTarget, dayKey });
    }

    const orphanReferences = [...existingByTarget.entries()]
        .filter(([target]) => !canonicalTargets.has(target) && !ambiguous.has(target))
        .flatMap(([, refs]) => refs);

    return { toCreate, toRemove, orphanReferences, ambiguousTargets };
}
