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
        hubPath: string | null
    ): Promise<NoteFile>;
    write(
        record: EventTaskRecord,
        targetFilePath: string,
        targetHeading: string,
        position: InsertPosition,
        detailNoteRef?: HubNoteRef | null
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
        position: InsertPosition
    ): Promise<void>;
}

export interface InboxSubmissionDependencies {
    writer: InboxSubmissionWriter;
    resolveTarget(record: InboxRecord): FocusTarget | null;
}

export type EventTaskSubmissionResult =
    | { ok: true; message: string }
    | { ok: false; message: string };

export async function submitEventTask(
    state: EventTaskFormState,
    dependencies: EventTaskSubmissionDependencies
): Promise<EventTaskSubmissionResult> {
    const { writer } = dependencies;
    let hubNoteRef: HubNoteRef | null = null;
    let hubNoteFilePath: string | null = null;

    if (state.hubMode === "create") {
        const hubName = state.hubCreateName.trim() || state.title.trim();
        if (hubName) {
            try {
                const hubFile = await writer.createHubNote(
                    hubName,
                    state.buildRecord(null),
                    state.hubCreateFolder.trim() || dependencies.defaultHubNotesFolder
                );
                hubNoteRef = { title: state.title.trim(), path: hubFile.path };
                hubNoteFilePath = hubFile.path;
                dependencies.openFile(hubFile);
            } catch (error) {
                return failure("Failed to create note", error);
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
                    hubNoteFilePath
                );
                detailNoteRef = { title: state.title.trim(), path: detailFile.path };
                dependencies.openFile(detailFile);
            } catch (error) {
                return failure("Failed to create detail note", error);
            }
        }
    }

    const heading = state.targetHeading.trim();
    const position = state.targetPosition;
    try {
        await writer.write(record, resolvedTargetFile, heading, position, detailNoteRef);
        if (state.writeToHubNote && hubNoteFilePath) {
            const targetRef: HubNoteRef = { title: state.title.trim(), path: resolvedTargetFile };
            await writer.write({ ...record, hubNoteRef: targetRef }, hubNoteFilePath, heading, position, detailNoteRef);
        }
    } catch (error) {
        return failure("Failed to save", error);
    }

    return { ok: true, message: state.kind === "event" ? "Event saved." : "Task saved." };
}

export async function submitInbox(
    state: EventTaskFormState,
    dependencies: InboxSubmissionDependencies
): Promise<EventTaskSubmissionResult> {
    const record = state.buildInboxRecord();
    const target = dependencies.resolveTarget(record);
    if (!target?.file.trim()) {
        return failure(
            "Failed to save Inbox",
            new Error("Selected Inbox destination is unavailable.")
        );
    }

    try {
        await dependencies.writer.writeInbox(
            record,
            target.file,
            target.heading,
            target.position
        );
    } catch (error) {
        return failure("Failed to save Inbox", error);
    }

    return { ok: true, message: "Inbox saved." };
}

function failure(prefix: string, error: unknown): EventTaskSubmissionResult {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `${prefix}: ${message}` };
}
