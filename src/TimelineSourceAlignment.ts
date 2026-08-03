export type TimelineTargetAlignment = "aligned" | "mismatch" | "unconfigured" | "unresolved";

export function effectiveTimelineSourceFolders(
    configuredFolders: readonly string[],
    dailyNotesFolder: string | null,
): string[] {
    const values = [...configuredFolders, dailyNotesFolder ?? ""];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const value of values) {
        const folder = normalizeFolder(value);
        if (!folder) continue;
        const key = folder.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(folder);
    }
    return result;
}

export function assessTimelineTarget(filePath: string, sourceFolders: readonly string[]): TimelineTargetAlignment {
    if (!filePath.trim()) return "unresolved";
    if (sourceFolders.length === 0) return "unconfigured";
    return isFileInTimelineSource(filePath, sourceFolders) ? "aligned" : "mismatch";
}

export function isFileInTimelineSource(filePath: string, sourceFolders: readonly string[]): boolean {
    const path = normalizePath(filePath);
    return sourceFolders.some((rawFolder) => {
        const folder = normalizeFolder(rawFolder);
        return Boolean(folder) && path.startsWith(`${folder}/`);
    });
}

function normalizeFolder(folder: string): string {
    return normalizePath(folder).replace(/\/+$/g, "");
}

function normalizePath(path: string): string {
    return path.trim().replace(/\\/g, "/").replace(/^\/+/, "");
}
