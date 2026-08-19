import {
    type ContextLinkNote,
    type LinkDestinationResolver,
    resolveContextPaths,
    resolvedMarkdownLinkPaths,
} from "./ContextLinkResolver.ts";
import { resolvedObjectReferencePaths } from "./ObjectReference.ts";
import { formatRelatedLog } from "./RelatedLog.ts";
import {
    type RelatedWriteOperation,
    type RelatedWriteReceipt,
    retryFailedRelatedWrites,
    writeRelatedDestinations,
} from "./RelatedWriteRecovery.ts";
import type { ScheduledItemFormData } from "./ScheduledItemFormData.ts";
import type { ContextSourceSettings } from "./types";

export interface ScheduledItemCreateRelatedDependencies {
    contextNotes: readonly ContextLinkNote[];
    contextSources: readonly ContextSourceSettings[];
    now?: Date;
    writeRelated: RelatedWriteOperation;
    resolveLinkDestination: LinkDestinationResolver;
    formatSourceLink?: (targetFilePath: string, linkedFilePath: string, label: string) => string;
}

export type ScheduledItemCreateRelatedResult =
    | { status: "success"; message: string }
    | { status: "partial"; message: string; recovery: RelatedWriteReceipt };

export async function writeScheduledItemCreateRelated(
    data: ScheduledItemFormData,
    primaryPath: string,
    dependencies: ScheduledItemCreateRelatedDependencies,
): Promise<ScheduledItemCreateRelatedResult> {
    const destinations = resolveContextPaths(
        [
            ...resolvedObjectReferencePaths(data.description),
            ...resolvedMarkdownLinkPaths(data.description, primaryPath, dependencies.resolveLinkDestination),
        ],
        [...dependencies.contextNotes],
        [...dependencies.contextSources],
    );
    const temporal = relatedTemporal(data, dependencies.now ?? new Date());
    const requests = destinations.map((destination) => ({
        destinationPath: destination.filePath,
        heading: destination.relatedHeading,
        position: destination.relatedPosition,
        markdown: formatRelatedLog({
            kind: data.kind,
            title: data.title,
            occurredAt: temporal.occurredAt,
            endedAt: temporal.endedAt,
            allDay: temporal.allDay,
            primaryFilePath: primaryPath,
            destinationFilePath: destination.filePath,
            formatSourceLink: dependencies.formatSourceLink,
        }),
    }));
    const recovery = await writeRelatedDestinations(requests, dependencies.writeRelated);
    return recovery.failedWrites.length > 0
        ? {
              status: "partial",
              message: `Scheduled Item saved, but ${recovery.failedWrites.length} related log write(s) failed.`,
              recovery,
          }
        : { status: "success", message: data.kind === "event" ? "Event created." : "Task created." };
}

export async function retryScheduledItemCreateRelated(
    result: Extract<ScheduledItemCreateRelatedResult, { status: "partial" }>,
    writeRelated: RelatedWriteOperation,
): Promise<ScheduledItemCreateRelatedResult> {
    const recovery = await retryFailedRelatedWrites(result.recovery, writeRelated);
    return recovery.failedWrites.length > 0
        ? {
              status: "partial",
              message: `Scheduled Item saved, but ${recovery.failedWrites.length} related log write(s) failed.`,
              recovery,
          }
        : { status: "success", message: "Related logs saved." };
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
