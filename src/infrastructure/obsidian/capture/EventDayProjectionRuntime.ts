import type { App } from "obsidian";
import {
    type EventDayProjectionInput,
    type EventDayProjectionResult,
    projectEventDays,
    retryEventDayProjection,
} from "../../../features/capture/scheduled-item/application/EventDayProjection.ts";
import { parseLocalDateTime } from "../../../features/capture/scheduled-item/domain/ScheduledItemFormAdapter.ts";
import type { FocusNotesSettings } from "../../../features/settings/domain/FocusNotesSettings.ts";
import { TargetResolver } from "./TargetResolver.ts";
import type { EventTaskWriter } from "./EventTaskWriter.ts";

/** Shared desktop/mobile glue wiring EventDayProjection's pure service to real vault I/O. */
export function runEventDayProjection(
    _app: App,
    settings: FocusNotesSettings,
    input: EventDayProjectionInput,
    previousTouchedDayKeys: readonly string[],
    writer: EventTaskWriter,
): Promise<EventDayProjectionResult> {
    return projectEventDays(input, previousTouchedDayKeys, dependencies(settings, writer));
}

export function retryEventDayProjectionRuntime(
    _app: App,
    settings: FocusNotesSettings,
    pending: Extract<EventDayProjectionResult, { status: "partial" }>,
    writer: EventTaskWriter,
): Promise<EventDayProjectionResult> {
    return retryEventDayProjection(pending, dependencies(settings, writer));
}

function dependencies(settings: FocusNotesSettings, writer: EventTaskWriter) {
    const resolver = new TargetResolver(settings);
    return {
        resolveDayFile: (dayKey: string) => {
            const day = parseLocalDateTime(dayKey, true) ?? new Date(dayKey);
            return resolver.getPeriodicalTarget("daily", day)?.file ?? "";
        },
        writeReference: (request: {
            destinationPath: string;
            heading: string;
            position: "start" | "end";
            markdown: string;
        }) => writer.writeRelated(request.markdown, request.destinationPath, request.heading, request.position),
        removeReference: (request: { destinationPath: string; canonicalTarget: string }) =>
            writer.removeEventDayReference(request.destinationPath, request.canonicalTarget),
    };
}
