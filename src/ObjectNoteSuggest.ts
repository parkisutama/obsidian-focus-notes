import { AbstractInputSuggest, type App, prepareFuzzySearch } from "obsidian";
import { ContextSuggestionIndex, type SuggestionMatcher } from "./InboxSuggestions";
import { readContextSuggestionNotes } from "./ObsidianInboxSuggestionSource";
import { applyInputSuggestion } from "./SuggestionSelection";
import type { ContextSourceSettings } from "./types";

interface ObjectNoteSuggestion {
    path: string;
    label: string;
    sourceName: string | null;
}

/**
 * Task's "Save to" suggester. Prioritizes notes belonging to whichever Object
 * Sources the user marked as valid Task destinations (captureTask.
 * allowedSourceIds) — the same folder+property-filter scoping the @ mention
 * suggester already uses — and falls back to a plain vault-wide file search
 * when nothing configured matches what's typed, so free-text path entry
 * always stays available.
 */
export class ObjectNoteSuggest extends AbstractInputSuggest<ObjectNoteSuggestion> {
    private index: ContextSuggestionIndex | null = null;

    constructor(
        app: App,
        private inputEl: HTMLInputElement,
        private getAllowedSources: () => ContextSourceSettings[],
    ) {
        super(app, inputEl);
    }

    getSuggestions(query: string): ObjectNoteSuggestion[] {
        const sources = this.getAllowedSources();
        if (sources.length > 0) {
            this.index ??= new ContextSuggestionIndex(readContextSuggestionNotes(this.app));
            const matched = this.index
                .query(sources, this.matcher(query), 20)
                .map((suggestion) => ({
                    path: suggestion.filePath,
                    label: suggestion.label,
                    sourceName: suggestion.sourceName,
                }));
            if (matched.length > 0) return matched;
        }
        const lower = query.toLowerCase();
        return this.app.vault
            .getMarkdownFiles()
            .filter((file) => file.path.toLowerCase().includes(lower))
            .slice(0, 20)
            .map((file) => ({ path: file.path, label: file.path, sourceName: null }));
    }

    renderSuggestion(suggestion: ObjectNoteSuggestion, el: HTMLElement): void {
        el.setText(suggestion.sourceName ? `${suggestion.label} — ${suggestion.sourceName}` : suggestion.label);
    }

    selectSuggestion(suggestion: ObjectNoteSuggestion): void {
        applyInputSuggestion(this.inputEl, suggestion.path);
        this.close();
    }

    private matcher(query: string): SuggestionMatcher {
        if (!query.trim()) return () => 0;
        const search = prepareFuzzySearch(query);
        return (text) => search(text)?.score ?? null;
    }
}
