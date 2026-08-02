import type { EventTaskFormState, InboxRecord } from "./EventTaskFormState";
import type { EventTaskRecord, HubNoteRef } from "./EventTaskWriter";
import { resolveContextLinks, type ContextLinkNote } from "./ContextLinkResolver.ts";
import { formatEventTaskEntry } from "./EventTaskMarkdown.ts";
import { formatRelatedLog } from "./RelatedLog.ts";
import {
    type RelatedWriteReceipt,
    type RelatedWriteRequest,
    retryFailedRelatedWrites,
    writeRelatedDestinations,
} from "./RelatedWriteRecovery.ts";
import type { ContextSourceSettings, FocusTarget, InsertPosition } from "./types";

interface NoteFile {
    path: string;
}

interface EventTaskSubmissionWriter {
    createHubNote(title: string, record: EventTaskRecord, folder: string): Promise<NoteFile>;
    createDetailNote(
        title: string,
        record: EventTaskRecord,
        folder: string,
        targetPath: string,
        hubPath: string | null,
    ): Promise<NoteFile>;
    write(
        record: EventTaskRecord,
        targetFilePath: string,
        targetHeading: string,
        position: InsertPosition,
        detailNoteRef?: HubNoteRef | null,
    ): Promise<void>;
    writeRelated(
        markdown: string,
        targetFilePath: string,
        targetHeading: string,
        position: InsertPosition,
    ): Promise<void>;
}

export interface EventTaskSubmissionDependencies {
    writer: EventTaskSubmissionWriter;
    defaultHubNotesFolder: string;
    defaultDetailNotesFolder: string;
    resolveTargetFile(record: EventTaskRecord): string;
    findMarkdownFile(path: string): NoteFile | null;
    openFile(file: NoteFile): void;
    contextNotes?: readonly ContextLinkNote[];
    contextSources?: readonly ContextSourceSettings[];
}

interface InboxSubmissionWriter {
    writeInbox(
        record: InboxRecord,
        targetFilePath: string,
        targetHeading: string,
        position: InsertPosition,
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
    writer: Pick<EventTaskSubmissionWriter, "writeRelated">,
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

export async function submitEventTask(
    state: EventTaskFormState,
    dependencies: EventTaskSubmissionDependencies,
): Promise<EventTaskSubmissionResult> {
    const validation = state.validateTemporalFields();
    if (!validation.valid) {
        return failure("validation", validation.message);
    }

    const { writer } = dependencies;
    let hubNoteRef: HubNoteRef | null = null;
    let hubNoteFilePath: string | null = null;
    let createdHubNotePath: string | null = null;
    let detailNoteFilePath: string | null = null;

    if (state.hubMode === "create") {
        const hubName = state.hubCreateName.trim() || state.title.trim();
        if (hubName) {
            try {
                const hubFile = await writer.createHubNote(
                    hubName,
                    state.buildRecord(null),
                    state.hubCreateFolder.trim() || dependencies.defaultHubNotesFolder,
                );
                hubNoteRef = { title: state.title.trim(), path: hubFile.path };
                hubNoteFilePath = hubFile.path;
                createdHubNotePath = hubFile.path;
                dependencies.openFile(hubFile);
            } catch (error) {
                return failure("hub-note", "Failed to create note", error, createdHubNotePath, detailNoteFilePath);
            }
        }
    } else if (state.hubMode === "link" && state.hubLinkPath.trim()) {
        const typedPath = state.hubLinkPath.trim();
        const found = dependencies.findMarkdownFile(typedPath);
        const path = found?.path ?? (typedPath.endsWith(".md") ? typedPath : `${typedPath}.md`);
        hubNoteRef = { title: state.title.trim(), path };
        hubNoteFilePath = path;
    }

    const record = state.buildRecord(hubNoteRef);
    const resolvedTargetFile = dependencies.resolveTargetFile(record);
    let detailNoteRef: HubNoteRef | null = null;

    if (state.detailNoteEnabled) {
        const detailName = state.detailNoteName.trim() || state.title.trim();
        if (detailName) {
            try {
                const detailFile = await writer.createDetailNote(
                    detailName,
                    record,
                    state.detailNoteFolder.trim() || dependencies.defaultDetailNotesFolder,
                    resolvedTargetFile,
                    hubNoteFilePath,
                );
                detailNoteRef = { title: state.title.trim(), path: detailFile.path };
                detailNoteFilePath = detailFile.path;
                dependencies.openFile(detailFile);
            } catch (error) {
                return failure(
                    "detail-note",
                    "Failed to create detail note",
                    error,
                    createdHubNotePath,
                    detailNoteFilePath,
                );
            }
        }
    }

    const heading = state.targetHeading.trim();
    const position = state.targetPosition;
    try {
        await writer.write(record, resolvedTargetFile, heading, position, detailNoteRef);
    } catch (error) {
        return failure("primary", "Failed to save", error, createdHubNotePath, detailNoteFilePath);
    }

    const relatedWrites: RelatedWriteRequest[] = [];
    if (state.writeToHubNote && hubNoteFilePath) {
        const targetRef: HubNoteRef = { title: state.title.trim(), path: resolvedTargetFile };
        const relatedRecord = { ...record, hubNoteRef: targetRef };
        relatedWrites.push({
            destinationPath: hubNoteFilePath,
            heading,
            position,
            markdown: formatEventTaskEntry(relatedRecord, detailNoteRef),
        });
    }
    relatedWrites.push(...buildEventTaskContextWrites(state, record, resolvedTargetFile, dependencies));

    const recovery = await writeRelatedDestinations(relatedWrites, (request) =>
        writer.writeRelated(request.markdown, request.destinationPath, request.heading, request.position),
    );
    if (recovery.failedWrites.length > 0) {
        return partialResult(state.kind, resolvedTargetFile, recovery, createdHubNotePath, detailNoteFilePath);
    }

    return {
        status: "success",
        message: state.kind === "event" ? "Event saved." : "Task saved.",
        createdNotes: { hubPath: createdHubNotePath, detailPath: detailNoteFilePath },
    };
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
        await dependencies.writer.writeInbox(record, target.file, target.heading, target.position);
    } catch (error) {
        return failure("inbox", "Failed to save Inbox", error);
    }

    const relatedWrites = buildInboxContextWrites(record, target.file, dependencies);
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

function buildEventTaskContextWrites(
    state: EventTaskFormState,
    record: EventTaskRecord,
    primaryPath: string,
    dependencies: EventTaskSubmissionDependencies,
): RelatedWriteRequest[] {
    const destinations = resolveConfiguredContext(record.description, primaryPath, dependencies);
    const occurredAt =
        record.kind === "event" ? record.start : (record.timebox?.start ?? record.due ?? state.inboxCapturedAt);
    const endedAt = record.kind === "event" ? record.end : (record.timebox?.end ?? null);
    return destinations.map((destination) => ({
        destinationPath: destination.filePath,
        heading: destination.relatedHeading,
        position: "end",
        markdown: formatRelatedLog({
            kind: record.kind,
            title: record.title,
            occurredAt,
            endedAt,
            allDay:
                record.kind === "event" ? record.allDay : !record.timebox && record.due !== null && !record.dueHasTime,
            primaryFilePath: primaryPath,
            destinationFilePath: destination.filePath,
        }),
    }));
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
        position: "end",
        markdown: formatRelatedLog({
            kind: "inbox",
            title,
            occurredAt: record.capturedAt,
            primaryFilePath: primaryPath,
            destinationFilePath: destination.filePath,
        }),
    }));
}

function resolveConfiguredContext(
    markdown: string,
    primaryPath: string,
    dependencies: Pick<EventTaskSubmissionDependencies, "contextNotes" | "contextSources">,
) {
    if (!dependencies.contextNotes?.length || !dependencies.contextSources?.length) return [];
    return resolveContextLinks(markdown, primaryPath, [...dependencies.contextNotes], [...dependencies.contextSources]);
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
