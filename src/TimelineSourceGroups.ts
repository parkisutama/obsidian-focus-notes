import type { TimelineSourceGroup } from "./ScheduledItemTypes";

export function buildTimelineSourceGroups(
    configuredFolders: readonly string[],
    dailyNoteFolder: string | null,
): TimelineSourceGroup[] {
    const dailyFolder = normalizeFolder(dailyNoteFolder ?? "");
    const folders = configuredFolders.map(normalizeFolder).filter(Boolean);
    if (dailyFolder) folders.push(dailyFolder);

    return Array.from(new Set(folders)).map((folder) => {
        const isDailyNotes = folder === dailyFolder;
        return {
            id: isDailyNotes ? `daily-notes:${folder}` : `folder:${folder}`,
            name: isDailyNotes ? "Daily Notes" : folder.split("/").pop() || folder,
            folder,
        };
    });
}

export function timelineSourceHeadings(configured: readonly string[], captureHeading: string): string[] {
    return Array.from(new Set([...configured, captureHeading].map((heading) => heading.trim()).filter(Boolean)));
}

function normalizeFolder(folder: string): string {
    return folder.trim().replace(/^\/+|\/+$/g, "");
}
