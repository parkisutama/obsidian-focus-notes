import type { EventTaskRecord, HubNoteRef } from "./EventTaskWriter";
import { buildScheduledItemRecord } from "./ScheduledItemFormAdapter.ts";
import type { ScheduledItemFormData } from "./ScheduledItemFormData.ts";

interface DetailNoteFile {
    path: string;
}

export interface DetailNotePromotionDependencies {
    targetPath: string;
    findDetailNote(path: string): DetailNoteFile | null;
    createDetailNote(
        name: string,
        record: EventTaskRecord,
        folder: string,
        targetPath: string,
        hubPath: null,
    ): Promise<DetailNoteFile>;
    attachDetail(attachment: HubNoteRef | null): Promise<void>;
}

export type DetailNotePromotionResult =
    | { status: "success"; detailPath: string | null }
    | {
          status: "partial";
          message: string;
          detailPath: string;
          attachment: HubNoteRef;
      }
    | { status: "failure"; phase: "validation" | "create" | "attach"; message: string };

export async function promoteScheduledItemDetail(
    data: ScheduledItemFormData,
    dependencies: DetailNotePromotionDependencies,
): Promise<DetailNotePromotionResult> {
    const built = buildScheduledItemRecord(data);
    if (built.status === "invalid") {
        return { status: "failure", phase: "validation", message: built.message };
    }

    if (data.detailNote.mode === "none") {
        return attachExisting(null, null, dependencies.attachDetail);
    }
    if (data.detailNote.mode === "link") {
        const file = dependencies.findDetailNote(data.detailNote.path);
        if (!file) {
            return { status: "failure", phase: "validation", message: "Selected Detail Note does not exist." };
        }
        const attachment = { title: data.title.trim(), path: file.path };
        return attachExisting(attachment, file.path, dependencies.attachDetail);
    }

    let file: DetailNoteFile;
    try {
        file = await dependencies.createDetailNote(
            data.detailNote.name.trim(),
            built.record,
            data.detailNote.folder.trim(),
            dependencies.targetPath,
            null,
        );
    } catch (error) {
        return { status: "failure", phase: "create", message: `Failed to create Detail Note: ${errorMessage(error)}` };
    }

    const attachment = { title: data.title.trim(), path: file.path };
    try {
        await dependencies.attachDetail(attachment);
        return { status: "success", detailPath: file.path };
    } catch (error) {
        return {
            status: "partial",
            message: `Detail Note retained, but attachment failed: ${errorMessage(error)}`,
            detailPath: file.path,
            attachment,
        };
    }
}

export async function retryDetailNoteAttachment(
    result: Extract<DetailNotePromotionResult, { status: "partial" }>,
    attachDetail: (attachment: HubNoteRef) => Promise<void>,
): Promise<DetailNotePromotionResult> {
    try {
        await attachDetail(result.attachment);
        return { status: "success", detailPath: result.detailPath };
    } catch (error) {
        return { ...result, message: `Detail Note retained, but attachment failed: ${errorMessage(error)}` };
    }
}

async function attachExisting(
    attachment: HubNoteRef | null,
    detailPath: string | null,
    attachDetail: (attachment: HubNoteRef | null) => Promise<void>,
): Promise<DetailNotePromotionResult> {
    try {
        await attachDetail(attachment);
        return { status: "success", detailPath };
    } catch (error) {
        return { status: "failure", phase: "attach", message: `Failed to attach Detail Note: ${errorMessage(error)}` };
    }
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
