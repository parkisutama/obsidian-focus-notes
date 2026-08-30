export interface ReferenceRemovalRequest {
    readonly destinationPath: string;
    readonly canonicalTarget: string;
    /** Disambiguates multiple references in the same destination file (e.g. two Task timeboxes on one day). */
    readonly timeboxId?: string | null;
}

export interface FailedReferenceRemoval extends ReferenceRemovalRequest {
    readonly errorMessage: string;
}

export interface ReferenceRemovalReceipt {
    readonly completedKeys: readonly string[];
    readonly failedRemovals: readonly FailedReferenceRemoval[];
}

export type ReferenceRemovalOperation = (request: ReferenceRemovalRequest) => Promise<void>;

function dedupeKey(request: ReferenceRemovalRequest): string {
    return `${request.destinationPath}::${request.timeboxId ?? ""}`;
}

/** Mirrors writeRelatedDestinations/retryFailedRelatedWrites for stale-reference removal. */
export async function removeReferenceDestinations(
    requests: readonly ReferenceRemovalRequest[],
    remove: ReferenceRemovalOperation,
    completedKeys: readonly string[] = [],
): Promise<ReferenceRemovalReceipt> {
    const completed = [...completedKeys];
    const completedSet = new Set(completedKeys);
    const attempted = new Set<string>();
    const failedRemovals: FailedReferenceRemoval[] = [];

    for (const request of requests) {
        const key = dedupeKey(request);
        if (!request.destinationPath || completedSet.has(key) || attempted.has(key)) continue;
        attempted.add(key);
        try {
            await remove(request);
            completed.push(key);
            completedSet.add(key);
        } catch (error) {
            failedRemovals.push({ ...request, errorMessage: getErrorMessage(error) });
        }
    }

    return { completedKeys: completed, failedRemovals };
}

/** Retry only requests retained as failed; completed removals are not repeated. */
export function retryFailedReferenceRemovals(
    receipt: ReferenceRemovalReceipt,
    remove: ReferenceRemovalOperation,
): Promise<ReferenceRemovalReceipt> {
    return removeReferenceDestinations(receipt.failedRemovals, remove, receipt.completedKeys);
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
