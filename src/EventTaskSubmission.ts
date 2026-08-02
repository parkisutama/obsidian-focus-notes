import type { EventTaskFormState, InboxRecord } from "./EventTaskFormState";
import type { EventTaskRecord, HubNoteRef } from "./EventTaskWriter";
import type { FocusTarget, InsertPosition } from "./types";

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
}

export interface EventTaskSubmissionDependencies {
    writer: EventTaskSubmissionWriter;
    defaultHubNotesFolder: string;
    defaultDetailNotesFolder: string;
    resolveTargetFile(record: EventTaskRecord): string;
    findMarkdownFile(path: string): NoteFile | null;
    openFile(file: NoteFile): void;
}

interface InboxSubmissionWriter {
    writeInbox(
        record: InboxRecord,
        targetFilePath: string,
        targetHeading: string,
        position: InsertPosition,
    ): Promise<void>;
}

export interface InboxSubmissionDependencies {
    writer: InboxSubmissionWriter;
    resolveTarget(record: InboxRecord): FocusTarget | null;
}

export interface SubmissionCreatedNotes {
    hubPath: string | null;
    detailPath: string | null;
}

export interface RelatedWriteRecovery {
    readonly destinationPath: string;
    readonly heading: string;
    readonly position: InsertPosition;
    readonly record: EventTaskRecord;
    readonly detailNoteRef: HubNoteRef | null;
    readonly errorMessage: string;
}

export type EventTaskSubmissionResult =
    | { status: "success"; message: string; createdNotes: SubmissionCreatedNotes }
    | {
          status: "partial";
          message: string;
          createdNotes: SubmissionCreatedNotes;
          primaryPath: string;
          recovery: {
              readonly completedPaths: readonly string[];
              readonly failedWrites: readonly RelatedWriteRecovery[];
          };
      }
    | {
          status: "failure";
          phase: "hub-note" | "detail-note" | "primary" | "inbox";
          message: string;
          createdNotes: SubmissionCreatedNotes;
      };

export async function submitEventTask(
    state: EventTaskFormState,
    dependencies: EventTaskSubmissionDependencies,
): Promise<EventTaskSubmissionResult> {
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

    if (state.writeToHubNote && hubNoteFilePath) {
        const targetRef: HubNoteRef = { title: state.title.trim(), path: resolvedTargetFile };
        const relatedRecord = { ...record, hubNoteRef: targetRef };
        try {
            await writer.write(relatedRecord, hubNoteFilePath, heading, position, detailNoteRef);
        } catch (error) {
            const errorMessage = getErrorMessage(error);
            return {
                status: "partial",
                message: `${state.kind === "event" ? "Event" : "Task"} saved, but related note failed: ${errorMessage}`,
                createdNotes: { hubPath: createdHubNotePath, detailPath: detailNoteFilePath },
                primaryPath: resolvedTargetFile,
                recovery: {
                    completedPaths: [],
                    failedWrites: [
                        {
                            destinationPath: hubNoteFilePath,
                            heading,
                            position,
                            record: relatedRecord,
                            detailNoteRef,
                            errorMessage,
                        },
                    ],
                },
            };
        }
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

    return {
        status: "success",
        message: "Inbox saved.",
        createdNotes: { hubPath: null, detailPath: null },
    };
}

function failure(
    phase: "hub-note" | "detail-note" | "primary" | "inbox",
    prefix: string,
    error: unknown,
    hubPath: string | null = null,
    detailPath: string | null = null,
): EventTaskSubmissionResult {
    return {
        status: "failure",
        phase,
        message: `${prefix}: ${getErrorMessage(error)}`,
        createdNotes: { hubPath, detailPath },
    };
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
