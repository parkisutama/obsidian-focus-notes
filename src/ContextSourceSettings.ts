import type { ContextSourceSettings } from "./types";

export function createContextSource(existing: readonly ContextSourceSettings[]): ContextSourceSettings {
    const used = new Set(existing.map((source) => source.id));
    let id = "source";
    let suffix = 2;
    while (used.has(id)) {
        id = `source-${suffix}`;
        suffix += 1;
    }
    return {
        id,
        name: "New object",
        icon: "link",
        folders: [],
        filter: null,
        matchByFolder: true,
        matchByProperty: true,
        relatedHeading: "Related log",
        relatedPosition: "start",
        templatePath: "",
        placement: "flat",
        enabled: false,
        includeInTimeline: false,
    };
}

/**
 * Shared folders are unambiguous when every source uses one common property
 * and each source owns a distinct value (for example type: project/activity).
 */
export function findSharedFolderConflicts(sources: readonly ContextSourceSettings[]): Map<string, string[]> {
    const sourcesByFolder = new Map<string, { label: string; sources: ContextSourceSettings[] }>();
    for (const source of sources) {
        if (!source.enabled || !source.matchByFolder) continue;
        for (const rawFolder of source.folders) {
            const folder = normalizeFolder(rawFolder);
            if (!folder) continue;
            const key = folder.toLowerCase();
            const entry = sourcesByFolder.get(key) ?? { label: folder, sources: [] };
            if (!entry.sources.some((candidate) => candidate.id === source.id)) entry.sources.push(source);
            sourcesByFolder.set(key, entry);
        }
    }

    const conflicts = new Map<string, string[]>();
    for (const { label, sources: sharedSources } of sourcesByFolder.values()) {
        if (sharedSources.length < 2) continue;
        const filters = sharedSources.map((source) => (source.matchByProperty ? source.filter : null));
        const property = filters[0]?.property.trim().toLowerCase();
        const values = filters.map((filter) => filter?.value.trim().toLowerCase());
        const isDisjoint =
            Boolean(property) &&
            filters.every((filter) => filter?.property.trim().toLowerCase() === property) &&
            values.every(Boolean) &&
            new Set(values).size === values.length;
        if (!isDisjoint)
            conflicts.set(
                label,
                sharedSources.map((source) => source.id),
            );
    }
    return conflicts;
}

/** Resolve the Object Sources marked as valid Task destinations, enabled ones only. */
export function resolveAllowedTaskSources(
    contextSources: readonly ContextSourceSettings[],
    allowedSourceIds: readonly string[],
): ContextSourceSettings[] {
    const allowed = new Set(allowedSourceIds);
    return contextSources.filter((source) => source.enabled && allowed.has(source.id));
}

function normalizeFolder(folder: string): string {
    return folder
        .trim()
        .replace(/\\/g, "/")
        .replace(/^\/+|\/+$/g, "");
}
