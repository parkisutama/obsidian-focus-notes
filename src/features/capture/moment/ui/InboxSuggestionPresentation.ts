import type { ContextSuggestion } from "../application/InboxSuggestions.ts";
import type { ScheduledItemMentionCandidate } from "../../scheduled-item/application/ScheduledItemMentionIndex.ts";

export type ContextNotesSuggestion =
    | { kind: "mention"; value: ContextSuggestion }
    | { kind: "mention-kind"; value: "task" | "event" }
    | { kind: "scheduled-item"; value: ScheduledItemMentionCandidate }
    | { kind: "tag"; value: string }
    | { kind: "create-object"; value: string };

export function composeMentionSuggestions(
    queryValue: string,
    matches: ContextSuggestion[],
    hasCreatableSources: boolean,
    limit: number,
): ContextNotesSuggestion[] {
    const query = queryValue.trim();
    if (!query) {
        return [
            { kind: "mention-kind", value: "task" },
            { kind: "mention-kind", value: "event" },
            ...matches.slice(0, Math.max(0, limit - 2)).map((value) => ({ kind: "mention" as const, value })),
        ];
    }
    const suggestions = matches.map((value) => ({ kind: "mention" as const, value }));
    if (!hasCreatableSources) return suggestions;
    return [...suggestions.slice(0, Math.max(0, limit - 1)), { kind: "create-object", value: query }];
}

export function renderContextNotesSuggestion(suggestion: ContextNotesSuggestion, el: HTMLElement): void {
    if (suggestion.kind === "tag") {
        el.setText(suggestion.value);
        return;
    }
    if (suggestion.kind === "create-object") {
        el.createDiv({ text: `Create “${suggestion.value}”…`, cls: "fn-inbox-suggestion-label" });
        el.createDiv({ text: "New Object Note from a configured template", cls: "fn-inbox-suggestion-context" });
        return;
    }
    if (suggestion.kind === "mention-kind") {
        el.createDiv({ text: suggestion.value === "task" ? "Task" : "Event", cls: "fn-inbox-suggestion-label" });
        el.createDiv({ text: "Link an existing scheduled item", cls: "fn-inbox-suggestion-context" });
        return;
    }
    if (suggestion.kind === "scheduled-item") {
        el.createDiv({ text: suggestion.value.title, cls: "fn-inbox-suggestion-label" });
        el.createDiv({
            text: `${suggestion.value.kind === "task" ? "Task" : "Event"} · ${suggestion.value.status} · ${suggestion.value.filePath}`,
            cls: "fn-inbox-suggestion-context",
        });
        return;
    }
    el.createDiv({ text: suggestion.value.label, cls: "fn-inbox-suggestion-label" });
    el.createDiv({
        text: `${suggestion.value.sourceName} · ${suggestion.value.filePath}`,
        cls: "fn-inbox-suggestion-context",
    });
}
