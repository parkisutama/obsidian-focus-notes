import type { InsertPosition } from "../../../../shared/markdown/InsertPosition.ts";
import {
    type ReferenceRemovalOperation,
    type ReferenceRemovalReceipt,
    removeReferenceDestinations,
    retryFailedReferenceRemovals,
} from "../../application/ReferenceRemovalRecovery.ts";
import {
    type RelatedWriteOperation,
    type RelatedWriteReceipt,
    retryFailedRelatedWrites,
    writeRelatedDestinations,
} from "../../application/RelatedWriteRecovery.ts";
import { formatTaskDayReferenceLine } from "../domain/TaskDayReference.ts";
import {
    diffTaskDayReferences,
    planTaskDayReferences,
    type TaskDayReferencePlanEntry,
    type TaskDayReferenceTimebox,
} from "../domain/TaskDayReferencePlan.ts";
import { createDerivedBlockId, formatScheduledItemBlockTarget } from "../domain/ScheduledItemBlockId.ts";

export interface TaskDayProjectionInput {
    title: string;
    completed: boolean;
    dueDayKey: string | null;
    timeboxes: readonly TaskDayReferenceTimebox[];
    canonicalFilePath: string;
    canonicalBlockId: string;
    heading: string;
    position: InsertPosition;
}

export interface TaskDayProjectionDependencies {
    /** Resolves a local day key (YYYY-MM-DD) to the concrete Daily Note file path for that day. */
    resolveDayFile(dayKey: string): string;
    writeReference: RelatedWriteOperation;
    removeReference: ReferenceRemovalOperation;
    createReferenceBlockId?(): string;
}

export type TaskDayProjectionResult =
    | { status: "success"; plan: TaskDayReferencePlanEntry[] }
    | {
          status: "partial";
          message: string;
          plan: TaskDayReferencePlanEntry[];
          writeRecovery: RelatedWriteReceipt | null;
          removeRecovery: ReferenceRemovalReceipt | null;
      };

/**
 * Reconciles one Task's due/timebox day references against its previous plan (pass `[]` for a
 * brand-new Task). Returns the plan actually applied so the caller can persist it as the next
 * "previous plan" for a later edit.
 *
 * `previousCompleted`, when given and different from `input.completed`, forces every existing
 * reference to be rewritten (not just added/removed day-keys): a Task's completion state is
 * baked into each reference's checkbox at write time, so a plain day/timebox diff would miss it.
 */
export async function projectTaskDays(
    input: TaskDayProjectionInput,
    previousPlan: readonly TaskDayReferencePlanEntry[],
    dependencies: TaskDayProjectionDependencies,
    previousCompleted?: boolean,
): Promise<TaskDayProjectionResult> {
    const nextPlan = planTaskDayReferences(input.dueDayKey, input.timeboxes);
    const diff =
        previousCompleted !== undefined && previousCompleted !== input.completed
            ? { toCreate: nextPlan, toRemove: previousPlan }
            : diffTaskDayReferences(previousPlan, nextPlan);
    const mintReferenceId = dependencies.createReferenceBlockId ?? (() => createDerivedBlockId("task-ref"));
    const canonicalTarget = formatScheduledItemBlockTarget(input.canonicalFilePath, input.canonicalBlockId);

    const writeRequests = diff.toCreate.map((entry) => ({
        destinationPath: dependencies.resolveDayFile(entry.date),
        heading: input.heading,
        position: input.position,
        markdown: formatTaskDayReferenceLine({
            title: input.title,
            completed: input.completed,
            due: entry.due,
            timeboxId: entry.timeboxId,
            canonicalFilePath: input.canonicalFilePath,
            canonicalBlockId: input.canonicalBlockId,
            referenceBlockId: mintReferenceId(),
        }),
    }));
    const removeRequests = diff.toRemove.map((entry) => ({
        destinationPath: dependencies.resolveDayFile(entry.date),
        canonicalTarget,
        timeboxId: entry.timeboxId,
    }));

    const writeRecovery = writeRequests.length
        ? await writeRelatedDestinations(writeRequests, dependencies.writeReference)
        : null;
    const removeRecovery = removeRequests.length
        ? await removeReferenceDestinations(removeRequests, dependencies.removeReference)
        : null;

    return toResult(nextPlan, writeRecovery, removeRecovery);
}

export async function retryTaskDayProjection(
    pending: Extract<TaskDayProjectionResult, { status: "partial" }>,
    dependencies: Pick<TaskDayProjectionDependencies, "writeReference" | "removeReference">,
): Promise<TaskDayProjectionResult> {
    const writeRecovery = pending.writeRecovery?.failedWrites.length
        ? await retryFailedRelatedWrites(pending.writeRecovery, dependencies.writeReference)
        : pending.writeRecovery;
    const removeRecovery = pending.removeRecovery?.failedRemovals.length
        ? await retryFailedReferenceRemovals(pending.removeRecovery, dependencies.removeReference)
        : pending.removeRecovery;
    return toResult(pending.plan, writeRecovery, removeRecovery);
}

function toResult(
    plan: TaskDayReferencePlanEntry[],
    writeRecovery: RelatedWriteReceipt | null,
    removeRecovery: ReferenceRemovalReceipt | null,
): TaskDayProjectionResult {
    const failed = (writeRecovery?.failedWrites.length ?? 0) + (removeRecovery?.failedRemovals.length ?? 0);
    return failed > 0
        ? {
              status: "partial",
              message: `Task saved, but ${failed} day reference update(s) failed.`,
              plan,
              writeRecovery,
              removeRecovery,
          }
        : { status: "success", plan };
}
