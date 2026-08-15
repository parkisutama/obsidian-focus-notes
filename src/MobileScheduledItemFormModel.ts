import type { ScheduledItemFormData } from "./ScheduledItemFormData.ts";

export interface MobileScheduledItemFormModelInput {
    mode: "create" | "edit";
    data: ScheduledItemFormData;
    contextLabel: string;
    busy: boolean;
    recovery: boolean;
}

export interface MobileScheduledItemFormModel {
    heading: string;
    contextLabel: string;
    submitLabel: string;
    submitDisabled: boolean;
    fieldsDisabled: boolean;
    ariaBusy: "true" | "false";
    showCreateTarget: boolean;
    sections: readonly ["identity", "schedule", "description", "detail"];
}

export function buildMobileScheduledItemFormModel(
    input: MobileScheduledItemFormModelInput,
): MobileScheduledItemFormModel {
    const itemLabel = input.data.kind === "task" ? "Task" : "Event";
    return {
        heading: `${input.mode === "create" ? "Create" : "Edit"} ${itemLabel}`,
        contextLabel: input.contextLabel,
        submitLabel: input.busy
            ? "Saving…"
            : input.recovery
              ? "Retry remaining writes"
              : input.mode === "create"
                ? `Create ${itemLabel}`
                : "Save changes",
        submitDisabled: input.busy,
        fieldsDisabled: input.busy || input.recovery,
        ariaBusy: input.busy ? "true" : "false",
        showCreateTarget: input.mode === "create",
        sections: ["identity", "schedule", "description", "detail"],
    };
}
