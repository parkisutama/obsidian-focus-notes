export interface SuggestionInput {
    value: string;
    trigger(eventName: "input" | "change"): void;
}

/** Keep reactive controls and persistence-on-change consumers in sync. */
export function applyInputSuggestion(input: SuggestionInput, value: string): void {
    input.value = value;
    input.trigger("input");
    input.trigger("change");
}
