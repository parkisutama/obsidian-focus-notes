import { appendScheduledItemBlockId } from "./features/capture/scheduled-item/domain/ScheduledItemBlockId.ts";
import type { ScheduledItem } from "./features/capture/scheduled-item/domain/ScheduledItem.ts";
import type { TaskFormatChange } from "./TaskFormatWriter.ts";

export function buildScheduledItemIdentityChange(item: ScheduledItem, blockId: string): TaskFormatChange | null {
    if (item.blockId) return null;
    return {
        lineNumber: item.source.lineNumber,
        rawLine: item.rawLine,
        normalizedLine: appendScheduledItemBlockId(item.rawLine, blockId),
    };
}
