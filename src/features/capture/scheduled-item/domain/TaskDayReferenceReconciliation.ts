import {
    diffTaskDayReferences,
    planTaskDayReferences,
    type TaskDayReferencePlanEntry,
    type TaskDayReferenceTimebox,
} from "./TaskDayReferencePlan.ts";

export interface TaskCanonicalSnapshot {
    canonicalTarget: string;
    dueDayKey: string | null;
    timeboxes: readonly TaskDayReferenceTimebox[];
}

export interface ExistingTaskDayReference {
    canonicalTarget: string;
    /** File the reference line actually lives in — needed to repair/remove it. */
    destinationPath: string;
    date: string;
    due: boolean;
    timeboxId: string | null;
}

export interface TaskDayReferenceFix {
    canonicalTarget: string;
    entry: TaskDayReferencePlanEntry;
}

export interface TaskDayReferenceReconciliationResult {
    toCreate: TaskDayReferenceFix[];
    toRemove: TaskDayReferenceFix[];
    /** Existing references whose canonical Task no longer exists — reported, never auto-removed. */
    orphanReferences: ExistingTaskDayReference[];
    /** Canonical targets that appear more than once in `canonicalTasks` — skipped, never guessed. */
    ambiguousTargets: string[];
}

/**
 * Rebuilds the expected Task day-reference set purely from canonical truth (`canonicalTasks`) and
 * compares it against what's actually on disk (`existingReferences`), reusing the same
 * plan/diff primitives the incremental write path uses (Task 37) so a full rebuild and a single
 * edit converge to the exact same Markdown shape. A target seen twice in `canonicalTasks` (a
 * duplicated block id) is left untouched rather than reconciled against either copy.
 */
export function reconcileTaskDayReferences(
    canonicalTasks: readonly TaskCanonicalSnapshot[],
    existingReferences: readonly ExistingTaskDayReference[],
): TaskDayReferenceReconciliationResult {
    const targetCounts = new Map<string, number>();
    for (const task of canonicalTasks) {
        targetCounts.set(task.canonicalTarget, (targetCounts.get(task.canonicalTarget) ?? 0) + 1);
    }
    const ambiguousTargets = [...targetCounts.entries()].filter(([, count]) => count > 1).map(([target]) => target);
    const ambiguous = new Set(ambiguousTargets);

    const existingByTarget = new Map<string, ExistingTaskDayReference[]>();
    for (const ref of existingReferences) {
        const list = existingByTarget.get(ref.canonicalTarget) ?? [];
        list.push(ref);
        existingByTarget.set(ref.canonicalTarget, list);
    }

    const toCreate: TaskDayReferenceFix[] = [];
    const toRemove: TaskDayReferenceFix[] = [];
    const canonicalTargets = new Set<string>();

    for (const task of canonicalTasks) {
        canonicalTargets.add(task.canonicalTarget);
        if (ambiguous.has(task.canonicalTarget)) continue;

        const nextPlan = planTaskDayReferences(task.dueDayKey, task.timeboxes);
        const previousPlan: TaskDayReferencePlanEntry[] = (existingByTarget.get(task.canonicalTarget) ?? []).map(
            (ref) => ({ date: ref.date, due: ref.due, timeboxId: ref.timeboxId }),
        );
        const diff = diffTaskDayReferences(previousPlan, nextPlan);
        for (const entry of diff.toCreate) toCreate.push({ canonicalTarget: task.canonicalTarget, entry });
        for (const entry of diff.toRemove) toRemove.push({ canonicalTarget: task.canonicalTarget, entry });
    }

    const orphanReferences = [...existingByTarget.entries()]
        .filter(([target]) => !canonicalTargets.has(target) && !ambiguous.has(target))
        .flatMap(([, refs]) => refs);

    return { toCreate, toRemove, orphanReferences, ambiguousTargets };
}
