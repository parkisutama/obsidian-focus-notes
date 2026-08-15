import type { ScheduledItemFormData } from "./ScheduledItemFormData";

export type DesktopScheduledItemFormSection = "identity" | "task" | "event" | "description" | "detail";

export interface DesktopScheduledItemFormModelInput {
    mode: "create" | "edit";
    data: ScheduledItemFormData;
    contextLabel: string;
    busy: boolean;
    recovery: boolean;
}

export interface DesktopScheduledItemFormModel {
    heading: string;
    contextLabel: string;
    sections: DesktopScheduledItemFormSection[];
    showEventTimes: boolean;
    showActualTimes: boolean;
    detailFields: "none" | "link" | "create";
    submitLabel: string;
    submitDisabled: boolean;
    ariaBusy: "true" | "false";
}

export function buildDesktopScheduledItemFormModel(
    input: DesktopScheduledItemFormModelInput,
): DesktopScheduledItemFormModel {
    const kindLabel = input.data.kind === "task" ? "Task" : "Event";
    return {
        heading: `${input.mode === "create" ? "Create" : "Edit"} ${kindLabel}`,
        contextLabel: input.contextLabel,
        sections: ["identity", input.data.kind, "description", "detail"],
        showEventTimes: input.data.kind === "event" && !input.data.allDay,
        showActualTimes: input.data.kind === "event" && input.data.status === "completed" && input.data.actual !== null,
        detailFields: input.data.detailNote.mode,
        submitLabel: input.busy
            ? "Saving…"
            : input.recovery
              ? "Retry pending writes"
              : input.mode === "create"
                ? `Create ${kindLabel.toLowerCase()}`
                : "Save changes",
        submitDisabled: input.busy,
        ariaBusy: input.busy ? "true" : "false",
    };
}
