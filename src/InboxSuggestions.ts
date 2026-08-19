import type { ContextSourceSettings } from "./types";
import { contextSourceMatchesNote } from "./ContextSourceScope.ts";

export type MentionMatchSource = "filename" | "alias";

export interface SuggestionNote {
    path: string;
    basename: string;
    aliases: string[];
    properties?: Record<string, unknown>;
}

export interface ContextSuggestion {
    kind: "object";
    filePath: string;
    label: string;
    matchedBy: MentionMatchSource;
    sourceId: string;
    sourceName: string;
    sourceIcon: string;
}

export type SuggestionMatcher = (text: string) => number | null;

/** Lazy metadata snapshot scoped to one open Inbox form. */
export class InboxSuggestionSnapshot {
    private notes: SuggestionNote[] | null = null;
    private tags: string[] | null = null;
    private readonly loadNotes: () => SuggestionNote[];
    private readonly loadTags: () => string[];

    constructor(loadNotes: () => SuggestionNote[], loadTags: () => string[]) {
        this.loadNotes = loadNotes;
        this.loadTags = loadTags;
    }

    getNotes(): SuggestionNote[] {
        this.notes ??= this.loadNotes();
        return this.notes;
    }

    getTags(): string[] {
        this.tags ??= this.loadTags();
        return this.tags;
    }

    invalidate(): void {
        this.notes = null;
        this.tags = null;
    }
}

export class ContextSuggestionIndex {
    private readonly notes: SuggestionNote[];
    private readonly candidateCache = new Map<string, ContextSuggestion[]>();
    candidateBuildCount = 0;

    constructor(notes: SuggestionNote[]) {
        this.notes = notes;
    }

    query(sources: ContextSourceSettings[], matcher: SuggestionMatcher, limit = 20): ContextSuggestion[] {
        const candidates = this.getCandidates(sources);
        return rankAndLimit(candidates, matcher, (item) => item.label, limit);
    }

    private getCandidates(sources: ContextSourceSettings[]): ContextSuggestion[] {
        const key = JSON.stringify(
            sources.map(({ id, name, icon, folders, filter, enabled, matchByFolder, matchByProperty }) => ({
                id,
                name,
                icon,
                folders,
                filter,
                enabled,
                matchByFolder,
                matchByProperty,
            })),
        );
        const cached = this.candidateCache.get(key);
        if (cached) return cached;

        this.candidateBuildCount += 1;
        const candidates = sources.flatMap((source) => buildContextGroup(this.notes, source));
        this.candidateCache.set(key, candidates);
        return candidates;
    }
}

export function buildTagSuggestions(tags: string[], matcher: SuggestionMatcher, limit = 20): string[] {
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const raw of tags) {
        const value = raw.trim();
        if (!value) continue;
        const tag = value.startsWith("#") ? value : `#${value}`;
        const key = tag.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(tag);
    }
    return rankAndLimit(unique, matcher, (tag) => tag, limit);
}

function buildContextGroup(notes: SuggestionNote[], source: ContextSourceSettings): ContextSuggestion[] {
    if (!source.enabled) return [];
    const results: ContextSuggestion[] = [];
    const seen = new Set<string>();
    for (const note of notes) {
        if (!contextSourceMatchesNote(note, source)) continue;
        addContextSuggestion(results, seen, source, note.path, note.basename, "filename");
        for (const alias of note.aliases) {
            addContextSuggestion(results, seen, source, note.path, alias.trim(), "alias");
        }
    }
    return results;
}

function addContextSuggestion(
    results: ContextSuggestion[],
    seen: Set<string>,
    source: ContextSourceSettings,
    filePath: string,
    label: string,
    matchedBy: MentionMatchSource,
): void {
    if (!label) return;
    const key = `${source.id}\u0000${filePath}\u0000${label.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push({
        kind: "object",
        sourceId: source.id,
        sourceName: source.name,
        sourceIcon: source.icon,
        filePath,
        label,
        matchedBy,
    });
}

function rankAndLimit<T>(values: T[], matcher: SuggestionMatcher, textOf: (value: T) => string, limit: number): T[] {
    return values
        .map((value, index) => ({ value, index, score: matcher(textOf(value)) }))
        .filter((item): item is { value: T; index: number; score: number } => item.score !== null)
        .sort((a, b) => a.score - b.score || a.index - b.index)
        .slice(0, Math.max(0, limit))
        .map((item) => item.value);
}
