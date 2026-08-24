import type { EventTaskFormState } from "../../../../EventTaskFormState";
import {
    type ContextLinkNote,
    type LinkDestinationResolver,
    resolveContextLinks,
    resolveContextPaths,
} from "../../application/ContextLinkResolver.ts";
import {
    type RelatedWriteReceipt,
    type RelatedWriteRequest,
    retryFailedRelatedWrites,
    writeRelatedDestinations,
} from "../../application/RelatedWriteRecovery.ts";
import type { FocusTarget } from "../../domain/CaptureTarget";
import { parseObjectReferences } from "../../domain/ObjectReference.ts";
import { formatRelatedLog } from "../../domain/RelatedLog.ts";
import type { InboxRecord } from "../domain/InboxRecord";
import type { FormatInboxEntryOptions } from "../../../../InboxMarkdown.ts";
import type { ContextSourceSettings } from "../../../object-notes/domain/ContextSourceSettings";
import type { InsertPosition } from "../../../../shared/markdown/InsertPosition";

interface InboxSubmissionWriter {
    writeInbox(
        record: InboxRecord,
        targetFilePath: string,
        targetHeading: string,
        position: InsertPosition,
        options?: FormatInboxEntryOptions,
    ): Promise<void>;
    writeRelated(
        markdown: string,
        targetFilePath: string,
        targetHeading: string,
        position: InsertPosition,
    ): Promise<void>;
}

export interface InboxSubmissionDependencies {
    writer: InboxSubmissionWriter;
    resolveTarget(record: InboxRecord): FocusTarget | null;
    contextNotes?: readonly ContextLinkNote[];
    contextSources?: readonly ContextSourceSettings[];
    resolveLinkDestination: LinkDestinationResolver;
    formatSourceLink?: (targetFilePath: string, linkedFilePath: string, label: string) => string;
    /**
     * Optional same-day Daily Note target to backlink to, e.g. when the primary
     * capture was written to an ISO weekly note. Return null to skip the backlink
     * (unavailable Daily Notes integration, or the mode doesn't call for one).
     */
    resolveDailyBacklinkTarget?(record: InboxRecord): FocusTarget | null;
    /**
     * True when the resolved Moment target has a dated per-period heading
     * (e.g. a Weekly profile's per-day heading). The date is already carried
     * by that heading, so the written entry only needs a time, not a full
     * date-time.
     */
    usesDatedHeading?: boolean;
}

export interface SubmissionCreatedNotes {
    hubPath: string | null;
    detailPath: string | null;
}

export type EventTaskSubmissionResult =
    | { status: "success"; message: string; createdNotes: SubmissionCreatedNotes }
    | {
          status: "partial";
          kind: "inbox" | "event" | "task";
          message: string;
          createdNotes: SubmissionCreatedNotes;
          primaryPath: string;
          recovery: RelatedWriteReceipt;
      }
    | {
          status: "failure";
          phase: "validation" | "hub-note" | "detail-note" | "primary" | "inbox";
          message: string;
          createdNotes: SubmissionCreatedNotes;
      };

export type PartialSubmissionResult = Extract<EventTaskSubmissionResult, { status: "partial" }>;

export async function retryRelatedSubmission(
    result: PartialSubmissionResult,
    writer: Pick<InboxSubmissionWriter, "writeRelated">,
): Promise<EventTaskSubmissionResult> {
    const recovery = await retryFailedRelatedWrites(result.recovery, (request) =>
        writer.writeRelated(request.markdown, request.destinationPath, request.heading, request.position),
    );
    if (recovery.failedWrites.length > 0) {
        return partialResult(
            result.kind,
            result.primaryPath,
            recovery,
            result.createdNotes.hubPath,
            result.createdNotes.detailPath,
        );
    }
    return { status: "success", message: "Related logs saved.", createdNotes: result.createdNotes };
}

export async function submitInbox(
    state: EventTaskFormState,
    dependencies: InboxSubmissionDependencies,
): Promise<EventTaskSubmissionResult> {
    const record = state.buildInboxRecord();
    const target = dependencies.resolveTarget(record);
    if (!target?.file.trim()) {
        return failure("inbox", "Failed to save Inbox", new Error("Selected Inbox destination is unavailable."));
    }

    try {
        await dependencies.writer.writeInbox(record, target.file, target.heading, target.position, {
            timeOnly: dependencies.usesDatedHeading === true,
        });
    } catch (error) {
        return failure("inbox", "Failed to save Inbox", error);
    }

    const relatedWrites = buildInboxContextWrites(record, target.file, dependencies);
    const backlinkTarget = dependencies.resolveDailyBacklinkTarget?.(record) ?? null;
    if (backlinkTarget?.file.trim() && backlinkTarget.file !== target.file) {
        relatedWrites.push(buildDailyBacklinkWrite(record, target.file, backlinkTarget, dependencies.formatSourceLink));
    }
    const recovery = await writeRelatedDestinations(relatedWrites, (request) =>
        dependencies.writer.writeRelated(request.markdown, request.destinationPath, request.heading, request.position),
    );
    if (recovery.failedWrites.length > 0) {
        return partialResult("inbox", target.file, recovery, null, null);
    }

    return {
        status: "success",
        message: "Inbox saved.",
        createdNotes: { hubPath: null, detailPath: null },
    };
}

function buildInboxContextWrites(
    record: InboxRecord,
    primaryPath: string,
    dependencies: InboxSubmissionDependencies,
): RelatedWriteRequest[] {
    const destinations = resolveConfiguredContext(record.body, primaryPath, dependencies);
    const customTitle = record.title.trim() && record.title.trim() !== record.defaultTitle.trim() ? record.title : "";
    const title = customTitle || record.body.replace(/\s+/g, " ").trim() || "Inbox capture";
    return destinations.map((destination) => ({
        destinationPath: destination.filePath,
        heading: destination.relatedHeading,
        position: destination.relatedPosition,
        markdown: formatRelatedLog({
            kind: "inbox",
            title,
            occurredAt: record.capturedAt,
            primaryFilePath: primaryPath,
            destinationFilePath: destination.filePath,
            formatSourceLink: dependencies.formatSourceLink,
        }),
    }));
}

function buildDailyBacklinkWrite(
    record: InboxRecord,
    primaryPath: string,
    backlinkTarget: FocusTarget,
    formatSourceLink: InboxSubmissionDependencies["formatSourceLink"],
): RelatedWriteRequest {
    const customTitle = record.title.trim() && record.title.trim() !== record.defaultTitle.trim() ? record.title : "";
    const title = customTitle || record.body.replace(/\s+/g, " ").trim() || "Inbox capture";
    return {
        destinationPath: backlinkTarget.file,
        heading: backlinkTarget.heading,
        position: backlinkTarget.position,
        markdown: formatRelatedLog({
            kind: "inbox",
            title,
            occurredAt: record.capturedAt,
            primaryFilePath: primaryPath,
            destinationFilePath: backlinkTarget.file,
            formatSourceLink,
        }),
    };
}

function resolveConfiguredContext(
    markdown: string,
    primaryPath: string,
    dependencies: Pick<InboxSubmissionDependencies, "contextNotes" | "contextSources" | "resolveLinkDestination">,
) {
    if (!dependencies.contextNotes?.length || !dependencies.contextSources?.length) return [];
    const notes = [...dependencies.contextNotes];
    const sources = [...dependencies.contextSources];
    const objectPaths = parseObjectReferences(markdown)
        .map((occurrence) => occurrence.reference.vaultPath)
        .filter((path): path is string => path !== null);
    const destinations = resolveContextPaths(objectPaths, notes, sources);
    const seen = new Set(destinations.map((destination) => destination.filePath));
    for (const destination of resolveContextLinks(
        markdown,
        primaryPath,
        notes,
        sources,
        dependencies.resolveLinkDestination,
    )) {
        if (!seen.has(destination.filePath)) destinations.push(destination);
    }
    return destinations;
}

function partialResult(
    kind: "event" | "task" | "inbox",
    primaryPath: string,
    recovery: RelatedWriteReceipt,
    hubPath: string | null,
    detailPath: string | null,
): EventTaskSubmissionResult {
    const firstError = recovery.failedWrites[0]?.errorMessage ?? "Unknown error";
    const label = kind === "event" ? "Event" : kind === "task" ? "Task" : "Inbox";
    return {
        status: "partial",
        kind,
        message: `${label} saved, but ${recovery.failedWrites.length} related log write(s) failed: ${firstError}`,
        createdNotes: { hubPath, detailPath },
        primaryPath,
        recovery,
    };
}

function failure(
    phase: "validation" | "hub-note" | "detail-note" | "primary" | "inbox",
    prefix: string,
    error?: unknown,
    hubPath: string | null = null,
    detailPath: string | null = null,
): EventTaskSubmissionResult {
    return {
        status: "failure",
        phase,
        message: error === undefined ? prefix : `${prefix}: ${getErrorMessage(error)}`,
        createdNotes: { hubPath, detailPath },
    };
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
