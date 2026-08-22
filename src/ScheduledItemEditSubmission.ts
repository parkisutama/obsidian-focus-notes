import {
    addedResolvedMarkdownLinkPaths,
    type ContextLinkNote,
    type LinkDestinationResolver,
    resolveContextPaths,
} from "./ContextLinkResolver.ts";
import type { LedgerRecordSnapshot } from "./LedgerRecordSource.ts";
import { addedResolvedObjectReferencePaths } from "./ObjectReference.ts";
import { formatRelatedLog } from "./RelatedLog.ts";
import {
    type RelatedWriteOperation,
    type RelatedWriteReceipt,
    retryFailedRelatedWrites,
    writeRelatedDestinations,
} from "./RelatedWriteRecovery.ts";
import type { ScheduledItemBlockEdit } from "./ScheduledItemBlockEditor.ts";
import { buildScheduledItemFormBlockEdit } from "./ScheduledItemFormAdapter.ts";
import type { ScheduledItemFormData } from "./ScheduledItemFormData.ts";
import type { FormatDateValue } from "./TaskLineEditor.ts";
import type { ContextSourceSettings } from "./types";
import {
    appendScheduledItemBlockId,
    createScheduledItemBlockId,
    extractScheduledItemBlockId,
} from "./ScheduledItemBlockId.ts";

export interface ScheduledItemEditSubmissionDependencies {
    contextNotes: readonly ContextLinkNote[];
    contextSources: readonly ContextSourceSettings[];
    now?: Date;
    writePrimary(edit: ScheduledItemBlockEdit): Promise<void>;
    writeRelated: RelatedWriteOperation;
    resolveLinkDestination: LinkDestinationResolver;
    formatDateValue?: FormatDateValue;
    formatSourceLink?: (targetFilePath: string, linkedFilePath: string, label: string) => string;
    createBlockId?: (kind: "task" | "event") => string;
}

export type ScheduledItemEditSubmissionResult =
    | { status: "success"; message: string }
    | {
          status: "partial";
          message: string;
          primaryPath: string;
          recovery: RelatedWriteReceipt;
      }
    | { status: "failure"; phase: "validation" | "primary"; message: string };

export async function submitScheduledItemEdit(
    original: ScheduledItemFormData,
    next: ScheduledItemFormData,
    snapshot: LedgerRecordSnapshot,
    dependencies: ScheduledItemEditSubmissionDependencies,
): Promise<ScheduledItemEditSubmissionResult> {
    const built = buildScheduledItemFormBlockEdit(next, snapshot, dependencies.formatDateValue);
    if (built.status === "invalid") {
        return { status: "failure", phase: "validation", message: built.message };
    }
    if (!extractScheduledItemBlockId(built.edit.firstLine).blockId) {
        const createBlockId = dependencies.createBlockId ?? createScheduledItemBlockId;
        built.edit.firstLine = appendScheduledItemBlockId(built.edit.firstLine, createBlockId(next.kind));
    }

    try {
        await dependencies.writePrimary(built.edit);
    } catch (error) {
        return { status: "failure", phase: "primary", message: `Failed to save: ${errorMessage(error)}` };
    }

    const addedPaths = [
        ...addedResolvedObjectReferencePaths(original.description, next.description),
        ...addedResolvedMarkdownLinkPaths(
            original.description,
            next.description,
            snapshot.filePath,
            dependencies.resolveLinkDestination,
        ),
    ];
    const destinations = resolveContextPaths(
        addedPaths,
        [...dependencies.contextNotes],
        [...dependencies.contextSources],
    );
    const temporal = relatedTemporal(next, dependencies.now ?? new Date());
    const requests = destinations.map((destination) => ({
        destinationPath: destination.filePath,
        heading: destination.relatedHeading,
        position: destination.relatedPosition,
        markdown: formatRelatedLog({
            kind: next.kind,
            title: next.title,
            occurredAt: temporal.occurredAt,
            endedAt: temporal.endedAt,
            allDay: temporal.allDay,
            primaryFilePath: snapshot.filePath,
            destinationFilePath: destination.filePath,
            formatSourceLink: dependencies.formatSourceLink,
        }),
    }));
    const recovery = await writeRelatedDestinations(requests, dependencies.writeRelated);
    if (recovery.failedWrites.length > 0) {
        return {
            status: "partial",
            message: `Scheduled Item saved, but ${recovery.failedWrites.length} related log write(s) failed.`,
            primaryPath: snapshot.filePath,
            recovery,
        };
    }
    return { status: "success", message: next.kind === "event" ? "Event saved." : "Task saved." };
}

export async function retryScheduledItemEditRelated(
    result: Extract<ScheduledItemEditSubmissionResult, { status: "partial" }>,
    writeRelated: RelatedWriteOperation,
): Promise<ScheduledItemEditSubmissionResult> {
    const recovery = await retryFailedRelatedWrites(result.recovery, writeRelated);
    if (recovery.failedWrites.length > 0) {
        return {
            ...result,
            message: `Scheduled Item saved, but ${recovery.failedWrites.length} related log write(s) failed.`,
            recovery,
        };
    }
    return { status: "success", message: "Related logs saved." };
}

function relatedTemporal(
    data: ScheduledItemFormData,
    fallback: Date,
): { occurredAt: Date; endedAt: Date | null; allDay: boolean } {
    if (data.kind === "event") {
        return {
            occurredAt: parseLocal(data.start) ?? fallback,
            endedAt: data.end ? parseLocal(data.end) : null,
            allDay: data.allDay,
        };
    }
    const occurredAt = data.timebox?.start ?? data.due;
    return {
        occurredAt: occurredAt ? (parseLocal(occurredAt) ?? fallback) : fallback,
        endedAt: data.timebox ? parseLocal(data.timebox.end) : null,
        allDay: data.timebox === null && data.due !== null && !data.due.includes(" "),
    };
}

function parseLocal(value: string): Date | null {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?$/);
    if (!match) return null;
    const [year, month, day, hour, minute] = [match[1], match[2], match[3], match[4] ?? "0", match[5] ?? "0"].map(
        Number,
    );
    return new Date(year, month - 1, day, hour, minute);
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
