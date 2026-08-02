export type InboxMentionKind = "person" | "place";
export type MentionMatchSource = "filename" | "alias";

export interface SuggestionNote {
    path: string;
    basename: string;
    aliases: string[];
}

export interface MentionSuggestion {
    kind: InboxMentionKind;
    filePath: string;
    label: string;
    matchedBy: MentionMatchSource;
}

export type SuggestionMatcher = (text: string) => number | null;

export function buildMentionSuggestions(
    notes: SuggestionNote[],
    peopleFolders: string[],
    placeFolders: string[]
): MentionSuggestion[] {
    return [
        ...buildGroup(notes, peopleFolders, "person"),
        ...buildGroup(notes, placeFolders, "place")
    ];
}

export function filterMentionSuggestions(
    candidates: MentionSuggestion[],
    matcher: SuggestionMatcher,
    limit = 20
): MentionSuggestion[] {
    return rankAndLimit(candidates, matcher, item => item.label, limit);
}

export function buildTagSuggestions(
    tags: string[],
    matcher: SuggestionMatcher,
    limit = 20
): string[] {
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
    return rankAndLimit(unique, matcher, tag => tag, limit);
}

function buildGroup(
    notes: SuggestionNote[],
    folders: string[],
    kind: InboxMentionKind
): MentionSuggestion[] {
    const roots = folders.map(normalizeFolder).filter(Boolean);
    if (roots.length === 0) return [];
    const results: MentionSuggestion[] = [];
    const seen = new Set<string>();

    for (const note of notes) {
        if (!roots.some(root => note.path.startsWith(`${root}/`))) continue;
        addSuggestion(results, seen, kind, note.path, note.basename, "filename");
        for (const alias of note.aliases) {
            addSuggestion(results, seen, kind, note.path, alias.trim(), "alias");
        }
    }
    return results;
}

function addSuggestion(
    results: MentionSuggestion[],
    seen: Set<string>,
    kind: InboxMentionKind,
    filePath: string,
    label: string,
    matchedBy: MentionMatchSource
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

function rankAndLimit<T>(
    values: T[],
    matcher: SuggestionMatcher,
    textOf: (value: T) => string,
    limit: number
): T[] {
    return values
        .map((value, index) => ({ value, index, score: matcher(textOf(value)) }))
        .filter((item): item is { value: T; index: number; score: number } => item.score !== null)
        .sort((a, b) => a.score - b.score || a.index - b.index)
        .slice(0, Math.max(0, limit))
        .map(item => item.value);
}
