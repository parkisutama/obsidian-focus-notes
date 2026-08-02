import type { ContextSourceSettings } from "./types";

/** Normalize persisted source folders while preserving the user's order. */
export function normalizeInboxFolders(folders: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const folder of folders) {
        const normalized = folder
            .trim()
            .replace(/\\/g, "/")
            .replace(/^\/+|\/+$/g, "");
        if (!normalized) continue;
        if (normalized.split("/").some((part) => part === "." || part === "..")) continue;
        const key = normalized.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(normalized);
    }
    return result;
}

export function applyInboxContextOverrides(
    sources: ContextSourceSettings[],
    peopleFolders: string[],
    placeFolders: string[],
): ContextSourceSettings[] {
    return sources.map((source) => ({
        ...source,
        folders:
            source.id === "people" && peopleFolders.length > 0
                ? [...peopleFolders]
                : source.id === "places" && placeFolders.length > 0
                  ? [...placeFolders]
                  : [...source.folders],
        filter: source.filter ? { ...source.filter } : null,
    }));
}
