import type { ContextSourceSettings } from "./types";

export type InboxMentionKind = "person" | "place";
export type MentionMatchSource = "filename" | "alias";

export interface SuggestionNote {
    path: string;
    basename: string;
    aliases: string[];
    properties?: Record<string, unknown>;
}

export interface MentionSuggestion {
    kind: InboxMentionKind;
    filePath: string;
    label: string;
    matchedBy: MentionMatchSource;
}

export interface ContextSuggestion extends MentionSuggestion {
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
            sources.map(({ id, name, icon, folders, filter, enabled }) => ({
                id,
                name,
                icon,
                folders,
                filter,
                enabled,
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

export function buildMentionSuggestions(
    notes: SuggestionNote[],
    peopleFolders: string[],
    placeFolders: string[],
): MentionSuggestion[] {
    return [...buildGroup(notes, peopleFolders, "person"), ...buildGroup(notes, placeFolders, "place")];
}

export function filterMentionSuggestions(
    candidates: MentionSuggestion[],
    matcher: SuggestionMatcher,
    limit = 20,
): MentionSuggestion[] {
    return rankAndLimit(candidates, matcher, (item) => item.label, limit);
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

function buildGroup(notes: SuggestionNote[], folders: string[], kind: InboxMentionKind): MentionSuggestion[] {
    const roots = folders.map(normalizeFolder).filter(Boolean);
    if (roots.length === 0) return [];
    const results: MentionSuggestion[] = [];
    const seen = new Set<string>();

    for (const note of notes) {
        if (!roots.some((root) => note.path.startsWith(`${root}/`))) continue;
        addSuggestion(results, seen, kind, note.path, note.basename, "filename");
        for (const alias of note.aliases) {
            addSuggestion(results, seen, kind, note.path, alias.trim(), "alias");
        }
    }
    return results;
}

function buildContextGroup(notes: SuggestionNote[], source: ContextSourceSettings): ContextSuggestion[] {
    const roots = source.folders.map(normalizeFolder).filter(Boolean);
    if (!source.enabled || roots.length === 0) return [];
    const results: ContextSuggestion[] = [];
    const seen = new Set<string>();
    for (const note of notes) {
        if (!roots.some((root) => note.path.startsWith(`${root}/`))) continue;
        if (!matchesFilter(note.properties, source.filter)) continue;
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
        kind: source.id === "people" ? "person" : "place",
        sourceId: source.id,
        sourceName: source.name,
        sourceIcon: source.icon,
        filePath,
        label,
        matchedBy,
    });
}

function matchesFilter(
    properties: Record<string, unknown> | undefined,
    filter: ContextSourceSettings["filter"],
): boolean {
    if (!filter) return true;
    const actual = properties?.[filter.property];
    const expected = filter.value.toLowerCase();
    if (Array.isArray(actual)) return actual.some((value) => String(value).toLowerCase() === expected);
    return actual !== undefined && String(actual).toLowerCase() === expected;
}

function addSuggestion(
    results: MentionSuggestion[],
    seen: Set<string>,
    kind: InboxMentionKind,
    filePath: string,
    label: string,
    matchedBy: MentionMatchSource,
): void {
    if (!label) return;
    const key = `${kind}\u0000${filePath}\u0000${label.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push({ kind, filePath, label, matchedBy });
}

function normalizeFolder(folder: string): string {
    return folder.trim().replace(/^\/+|\/+$/g, "");
}

function rankAndLimit<T>(values: T[], matcher: SuggestionMatcher, textOf: (value: T) => string, limit: number): T[] {
    return values
        .map((value, index) => ({ value, index, score: matcher(textOf(value)) }))
        .filter((item): item is { value: T; index: number; score: number } => item.score !== null)
        .sort((a, b) => a.score - b.score || a.index - b.index)
        .slice(0, Math.max(0, limit))
        .map((item) => item.value);
}
