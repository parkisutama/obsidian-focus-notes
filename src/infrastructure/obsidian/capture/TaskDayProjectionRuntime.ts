import type { App } from "obsidian";
import {
    type TaskDayProjectionInput,
    type TaskDayProjectionResult,
    projectTaskDays,
    retryTaskDayProjection,
} from "../../../features/capture/scheduled-item/application/TaskDayProjection.ts";
import type { TaskDayReferencePlanEntry } from "../../../features/capture/scheduled-item/domain/TaskDayReferencePlan.ts";
import { parseLocalDateTime } from "../../../features/capture/scheduled-item/domain/ScheduledItemFormAdapter.ts";
import type { FocusNotesSettings } from "../../../features/settings/domain/FocusNotesSettings.ts";
import { TargetResolver } from "./TargetResolver.ts";
import type { EventTaskWriter } from "./EventTaskWriter.ts";
import type { WriteSuppressionTracker } from "./WriteSuppressionTracker.ts";

/** Shared desktop/mobile glue wiring TaskDayProjection's pure service to real vault I/O. */
export function runTaskDayProjection(
    _app: App,
    settings: FocusNotesSettings,
    input: TaskDayProjectionInput,
    previousPlan: readonly TaskDayReferencePlanEntry[],
    writer: EventTaskWriter,
    previousCompleted?: boolean,
    tracker?: WriteSuppressionTracker,
): Promise<TaskDayProjectionResult> {
    return projectTaskDays(input, previousPlan, dependencies(settings, writer, tracker), previousCompleted);
}

export function retryTaskDayProjectionRuntime(
    _app: App,
    settings: FocusNotesSettings,
    pending: Extract<TaskDayProjectionResult, { status: "partial" }>,
    writer: EventTaskWriter,
    tracker?: WriteSuppressionTracker,
): Promise<TaskDayProjectionResult> {
    return retryTaskDayProjection(pending, dependencies(settings, writer, tracker));
}

function dependencies(settings: FocusNotesSettings, writer: EventTaskWriter, tracker?: WriteSuppressionTracker) {
    const resolver = new TargetResolver(settings);
    return {
        resolveDayFile: (dayKey: string) => {
            const day = parseLocalDateTime(dayKey, true) ?? new Date(dayKey);
            return resolver.getPeriodicalTarget("daily", day)?.file ?? "";
        },
        writeReference: async (request: {
            destinationPath: string;
            heading: string;
            position: "start" | "end";
            markdown: string;
        }) => {
            tracker?.beginSuppress(request.destinationPath);
            try {
                await writer.writeRelated(request.markdown, request.destinationPath, request.heading, request.position);
            } finally {
                tracker?.endSuppress(request.destinationPath);
            }
        },
        removeReference: async (request: {
            destinationPath: string;
            canonicalTarget: string;
            timeboxId?: string | null;
        }) => {
            tracker?.beginSuppress(request.destinationPath);
            try {
                await writer.removeTaskDayReference(
                    request.destinationPath,
                    request.canonicalTarget,
                    request.timeboxId ?? null,
                );
            } finally {
                tracker?.endSuppress(request.destinationPath);
            }
        },
    };
}
