import type { InsertPosition } from "./types";

export interface RelatedWriteRequest {
    readonly destinationPath: string;
    readonly heading: string;
    readonly position: InsertPosition;
    readonly markdown: string;
}

export interface FailedRelatedWrite extends RelatedWriteRequest {
    readonly errorMessage: string;
}

export interface RelatedWriteReceipt {
    readonly completedPaths: readonly string[];
    readonly failedWrites: readonly FailedRelatedWrite[];
}

export type RelatedWriteOperation = (request: RelatedWriteRequest) => Promise<void>;

/** Execute each unique contextual destination once and retain a recovery-safe receipt. */
export async function writeRelatedDestinations(
    requests: readonly RelatedWriteRequest[],
    write: RelatedWriteOperation,
    completedPaths: readonly string[] = [],
): Promise<RelatedWriteReceipt> {
    const completed = [...completedPaths];
    const completedSet = new Set(completedPaths);
    const attempted = new Set<string>();
    const failedWrites: FailedRelatedWrite[] = [];

    for (const request of requests) {
        const path = request.destinationPath;
        if (!path || completedSet.has(path) || attempted.has(path)) continue;
        attempted.add(path);
        try {
            await write(request);
            completed.push(path);
            completedSet.add(path);
        } catch (error) {
            failedWrites.push({ ...request, errorMessage: getErrorMessage(error) });
        }
    }

    return { completedPaths: completed, failedWrites };
}

/** Retry only paths retained as failed; primary and completed writes are not inputs. */
export function retryFailedRelatedWrites(
    receipt: RelatedWriteReceipt,
    write: RelatedWriteOperation,
): Promise<RelatedWriteReceipt> {
    return writeRelatedDestinations(receipt.failedWrites, write, receipt.completedPaths);
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
