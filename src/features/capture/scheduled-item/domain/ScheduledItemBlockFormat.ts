import { canonicalizeScheduledItemBlock } from "./ScheduledItemBlockEditor.ts";

export type ScheduledItemBlockFormatPlan =
    | { status: "unchanged" }
    | { status: "needs-format"; normalizedBlock: string }
    | { status: "invalid" };

/**
 * Classifies whether a Scheduled Item block already matches the approved flat grammar
 * (Task 47-53's keyed prefixes, canonical child order, Task Focus Sessions as direct siblings)
 * or still carries one of the unreleased development shapes `ScheduledItemBlockEditor` tolerantly
 * reads. Re-running this on `normalizedBlock` always reports "unchanged".
 */
export function planScheduledItemBlockFormat(rawBlock: string): ScheduledItemBlockFormatPlan {
    const canonical = canonicalizeScheduledItemBlock(rawBlock);
    if (canonical === null) return { status: "invalid" };
    return canonical === rawBlock ? { status: "unchanged" } : { status: "needs-format", normalizedBlock: canonical };
}
