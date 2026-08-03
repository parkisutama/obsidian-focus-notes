/** A source folder owns its descendants and an optional sibling folder note named after the folder. */
export function isPathInContextSourceFolder(path: string, folder: string): boolean {
    const normalizedPath = normalizeVaultPath(path);
    const normalizedFolder = normalizeVaultPath(folder);
    if (!normalizedFolder) return false;
    return normalizedPath === `${normalizedFolder}.md` || normalizedPath.startsWith(`${normalizedFolder}/`);
}

function normalizeVaultPath(path: string): string {
    return path
        .trim()
        .replace(/\\/g, "/")
        .replace(/^\/+|\/+$/g, "");
}
