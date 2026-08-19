import type { TimelineSourceGroup } from "./ScheduledItemTypes";
import { isFileInTimelineSource, type TimelineTargetAlignment } from "./TimelineSourceAlignment.ts";
import type { ContextSourceSettings } from "./types";

export function buildTimelineSourceGroups(
    configuredFolders: readonly string[],
    dailyNoteFolder: string | null,
    objectSources: readonly ContextSourceSettings[],
): TimelineSourceGroup[] {
    const dailyFolder = normalizeFolder(dailyNoteFolder ?? "");
    const folders = configuredFolders.map(normalizeFolder).filter(Boolean);
    if (dailyFolder) folders.push(dailyFolder);

    const folderGroups = Array.from(new Set(folders)).map((folder) => {
        const isDailyNotes = folder === dailyFolder;
        return {
            id: isDailyNotes ? `daily-notes:${folder}` : `folder:${folder}`,
            name: isDailyNotes ? "Daily Notes" : folder.split("/").pop() || folder,
            folders: [folder],
            filter: null,
        };
    });
    const objectGroups = objectSources
        .filter((source) => source.enabled && source.includeInTimeline && source.folders.length > 0)
        .map((source) => ({
            id: `object:${source.id}`,
            name: source.name,
            folders: source.folders.map(normalizeFolder).filter(Boolean),
            filter: source.filter,
        }))
        .filter((source) => source.folders.length > 0);
    return [...folderGroups, ...objectGroups];
}

export function timelineSourceFolders(groups: readonly TimelineSourceGroup[]): string[] {
    return Array.from(new Set(groups.flatMap((group) => group.folders)));
}

export function matchTimelineSourceGroup(
    filePath: string,
    properties: Record<string, unknown> | undefined,
    groups: readonly TimelineSourceGroup[],
): TimelineSourceGroup | null {
    return (
        groups
            .flatMap((group, sourceIndex) => {
                if (!matchesProperty(properties, group.filter)) return [];
                const folderLength = Math.max(
                    0,
                    ...group.folders
                        .filter((folder) => isFileInTimelineSource(filePath, [folder]))
                        .map((folder) => folder.length),
                );
                return folderLength > 0
                    ? [{ group, folderLength, filterSpecificity: group.filter ? 1 : 0, sourceIndex }]
                    : [];
            })
            .sort(
                (a, b) =>
                    b.folderLength - a.folderLength ||
                    b.filterSpecificity - a.filterSpecificity ||
                    a.sourceIndex - b.sourceIndex,
            )[0]?.group ?? null
    );
}

export function assessTimelineTargetGroups(
    filePath: string,
    properties: Record<string, unknown> | undefined,
    groups: readonly TimelineSourceGroup[],
): TimelineTargetAlignment {
    if (!filePath.trim()) return "unresolved";
    if (groups.length === 0) return "unconfigured";
    return matchTimelineSourceGroup(filePath, properties, groups) ? "aligned" : "mismatch";
}

export function timelineSourceHeadings(configured: readonly string[], captureHeadings: readonly string[]): string[] {
    return Array.from(new Set([...configured, ...captureHeadings].map((heading) => heading.trim()).filter(Boolean)));
}

function normalizeFolder(folder: string): string {
    return folder.trim().replace(/^\/+|\/+$/g, "");
}

function matchesProperty(
    properties: Record<string, unknown> | undefined,
    filter: TimelineSourceGroup["filter"],
): boolean {
    if (!filter) return true;
    const actual = properties?.[filter.property];
    const expected = filter.value.toLowerCase();
    if (Array.isArray(actual)) return actual.some((value) => String(value).toLowerCase() === expected);
    return actual !== undefined && String(actual).toLowerCase() === expected;
}
