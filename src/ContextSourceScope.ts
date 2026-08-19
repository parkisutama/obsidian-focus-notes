import type { ContextSourceSettings } from "./types";

/** A source folder owns its descendants and an optional sibling folder note named after the folder. */
export function isPathInContextSourceFolder(path: string, folder: string): boolean {
    const normalizedPath = normalizeVaultPath(path);
    const normalizedFolder = normalizeVaultPath(folder);
    if (!normalizedFolder) return false;
    return normalizedPath === `${normalizedFolder}.md` || normalizedPath.startsWith(`${normalizedFolder}/`);
}

export function matchesContextFilter(
    properties: Record<string, unknown> | undefined,
    filter: ContextSourceSettings["filter"],
): boolean {
    if (!filter) return true;
    const actual = properties?.[filter.property];
    const expected = filter.value.toLowerCase();
    if (Array.isArray(actual)) return actual.some((value) => String(value).toLowerCase() === expected);
    return actual !== undefined && String(actual).toLowerCase() === expected;
}

/**
 * Whether a note belongs to an Object Source, honoring matchByFolder/matchByProperty
 * independently. Both toggles off means the source can never match anything. Shared by
 * the @ mention suggester (InboxSuggestions.ts) and the backlink destination resolver
 * (ContextLinkResolver.ts) so the two can't drift.
 */
export function contextSourceMatchesNote(
    note: { path: string; properties?: Record<string, unknown> },
    source: Pick<ContextSourceSettings, "folders" | "filter" | "matchByFolder" | "matchByProperty">,
): boolean {
    if (!source.matchByFolder && !source.matchByProperty) return false;
    if (source.matchByFolder) {
        const roots = source.folders.map((folder) => folder.trim()).filter(Boolean);
        if (roots.length === 0 || !roots.some((root) => isPathInContextSourceFolder(note.path, root))) return false;
    }
    if (source.matchByProperty && !matchesContextFilter(note.properties, source.filter)) return false;
    return true;
}

function normalizeVaultPath(path: string): string {
    return path
        .trim()
        .replace(/\\/g, "/")
        .replace(/^\/+|\/+$/g, "");
}
