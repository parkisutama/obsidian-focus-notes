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
import { formatEventDayReferenceLine, localDayKey, touchedLocalDays } from "../domain/EventDayReference.ts";
import { planEventDayReferences } from "../domain/EventDayReferencePlan.ts";
import { createDerivedBlockId, formatScheduledItemBlockTarget } from "../domain/ScheduledItemBlockId.ts";
import { parseLocalDateTime } from "../domain/ScheduledItemFormAdapter.ts";

/** Local day keys touched by an Event form's string fields, or `[]` when Planned Start doesn't parse. */
export function touchedDayKeysFromEventFormFields(start: string, end: string | null, allDay: boolean): string[] {
    const startDate = parseLocalDateTime(start, allDay);
    if (!startDate) return [];
    const endDate = !allDay && end ? parseLocalDateTime(end, false) : null;
    return touchedLocalDays(startDate, endDate).map(localDayKey);
}

export interface EventDayProjectionInput {
    title: string;
    start: Date;
    end: Date | null;
    allDay: boolean;
    canonicalFilePath: string;
    canonicalBlockId: string;
    heading: string;
    position: InsertPosition;
}

export interface EventDayProjectionDependencies {
    /** Resolves a local day key (YYYY-MM-DD) to the concrete Daily Note file path for that day. */
    resolveDayFile(dayKey: string): string;
    writeReference: RelatedWriteOperation;
    removeReference: ReferenceRemovalOperation;
    createReferenceBlockId?(): string;
}

export type EventDayProjectionResult =
    | { status: "success" }
    | {
          status: "partial";
          message: string;
          writeRecovery: RelatedWriteReceipt | null;
          removeRecovery: ReferenceRemovalReceipt | null;
      };

/**
 * Reconciles one Event's day references against its previously touched days: writes a reference
 * for every newly touched day and removes the reference from every day no longer touched, never
 * the canonical day itself. Pass an empty `previousTouchedDayKeys` for a brand-new Event.
 */
export async function projectEventDays(
    input: EventDayProjectionInput,
    previousTouchedDayKeys: readonly string[],
    dependencies: EventDayProjectionDependencies,
): Promise<EventDayProjectionResult> {
    const nextDayKeys = touchedLocalDays(input.start, input.end).map(localDayKey);
    const canonicalDayKey = localDayKey(input.start);
    const plan = planEventDayReferences(previousTouchedDayKeys, nextDayKeys, canonicalDayKey);
    const mintReferenceId = dependencies.createReferenceBlockId ?? (() => createDerivedBlockId("event-ref"));
    const canonicalTarget = formatScheduledItemBlockTarget(input.canonicalFilePath, input.canonicalBlockId);

    const writeRequests = plan.createDays.map((dayKey) => ({
        destinationPath: dependencies.resolveDayFile(dayKey),
        heading: input.heading,
        position: input.position,
        markdown: formatEventDayReferenceLine({
            title: input.title,
            start: input.start,
            end: input.end,
            allDay: input.allDay,
            canonicalFilePath: input.canonicalFilePath,
            canonicalBlockId: input.canonicalBlockId,
            referenceBlockId: mintReferenceId(),
        }),
    }));
    const removeRequests = plan.removeDays.map((dayKey) => ({
        destinationPath: dependencies.resolveDayFile(dayKey),
        canonicalTarget,
    }));

    const writeRecovery = writeRequests.length
        ? await writeRelatedDestinations(writeRequests, dependencies.writeReference)
        : null;
    const removeRecovery = removeRequests.length
        ? await removeReferenceDestinations(removeRequests, dependencies.removeReference)
        : null;

    return toResult(writeRecovery, removeRecovery);
}

export async function retryEventDayProjection(
    pending: Extract<EventDayProjectionResult, { status: "partial" }>,
    dependencies: Pick<EventDayProjectionDependencies, "writeReference" | "removeReference">,
): Promise<EventDayProjectionResult> {
    const writeRecovery = pending.writeRecovery?.failedWrites.length
        ? await retryFailedRelatedWrites(pending.writeRecovery, dependencies.writeReference)
        : pending.writeRecovery;
    const removeRecovery = pending.removeRecovery?.failedRemovals.length
        ? await retryFailedReferenceRemovals(pending.removeRecovery, dependencies.removeReference)
        : pending.removeRecovery;
    return toResult(writeRecovery, removeRecovery);
}

function toResult(
    writeRecovery: RelatedWriteReceipt | null,
    removeRecovery: ReferenceRemovalReceipt | null,
): EventDayProjectionResult {
    const failed = (writeRecovery?.failedWrites.length ?? 0) + (removeRecovery?.failedRemovals.length ?? 0);
    return failed > 0
        ? {
              status: "partial",
              message: `Event saved, but ${failed} day reference update(s) failed.`,
              writeRecovery,
              removeRecovery,
          }
        : { status: "success" };
}
