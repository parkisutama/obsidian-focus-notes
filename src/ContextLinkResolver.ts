import { isPathInContextSourceFolder } from "./ContextSourceScope.ts";
import type { ContextSourceSettings } from "./types";

export interface ContextLinkNote {
    path: string;
    properties?: Record<string, unknown>;
}

export interface ContextDestination {
    filePath: string;
    sourceId: string;
    sourceName: string;
    relatedHeading: string;
}

interface SourceMatch {
    source: ContextSourceSettings;
    folderLength: number;
    filterSpecificity: number;
    sourceIndex: number;
}

const MARKDOWN_LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^)]*["'])?\)/g;

/**
 * Resolve ordinary Markdown links in a capture to enabled contextual objects.
 * The configured source order is the tie-breaker when equally specific folders overlap.
 */
export function resolveContextLinks(
    markdown: string,
    sourceFilePath: string,
    notes: ContextLinkNote[],
    sources: ContextSourceSettings[],
): ContextDestination[] {
    const notesByPath = new Map(notes.map((note) => [normalizeVaultPath(note.path), note]));
    const destinations: ContextDestination[] = [];
    const seen = new Set<string>();

    for (const match of markdown.matchAll(MARKDOWN_LINK)) {
        const path = resolveMarkdownDestination(sourceFilePath, match[1] ?? "");
        if (!path || seen.has(path)) continue;
        const note = notesByPath.get(path);
        if (!note) continue;
        const source = findSource(note, path, sources);
        if (!source) continue;

        seen.add(path);
        destinations.push({
            filePath: path,
            sourceId: source.id,
            sourceName: source.name,
            relatedHeading: source.relatedHeading,
        });
    }
    return destinations;
}

export function resolveContextPaths(
    paths: readonly string[],
    notes: ContextLinkNote[],
    sources: ContextSourceSettings[],
): ContextDestination[] {
    const notesByPath = new Map(notes.map((note) => [normalizeVaultPath(note.path), note]));
    const destinations: ContextDestination[] = [];
    const seen = new Set<string>();
    for (const rawPath of paths) {
        const path = normalizeVaultPath(rawPath);
        if (!path || seen.has(path)) continue;
        const note = notesByPath.get(path);
        if (!note) continue;
        const source = findSource(note, path, sources);
        if (!source) continue;
        seen.add(path);
        destinations.push({
            filePath: path,
            sourceId: source.id,
            sourceName: source.name,
            relatedHeading: source.relatedHeading,
        });
    }
    return destinations;
}

function resolveMarkdownDestination(sourceFilePath: string, rawDestination: string): string | null {
    const raw = rawDestination.replace(/^<|>$/g, "");
    if (!raw || /^[a-z][a-z\d+.-]*:/i.test(raw) || raw.startsWith("#") || raw.startsWith("//")) return null;
    const withoutFragment = raw.split(/[?#]/, 1)[0] ?? "";
    let decoded: string;
    try {
        decoded = decodeURIComponent(withoutFragment);
    } catch {
        return null;
    }

    const sourceDirectory = normalizeVaultPath(sourceFilePath).split("/").slice(0, -1);
    const destination = decoded.startsWith("/")
        ? decoded.slice(1).split("/")
        : [...sourceDirectory, ...decoded.split("/")];
    const normalized: string[] = [];
    for (const segment of destination) {
        if (!segment || segment === ".") continue;
        if (segment === "..") {
            if (normalized.length === 0) return null;
            normalized.pop();
        } else {
            normalized.push(segment);
        }
    }
    return normalized.join("/");
}

function findSource(
    note: ContextLinkNote,
    path: string,
    sources: ContextSourceSettings[],
): ContextSourceSettings | null {
    const matches: SourceMatch[] = [];
    sources.forEach((source, sourceIndex) => {
        if (!source.enabled || !matchesProperty(note.properties, source.filter)) return;
        for (const rawFolder of source.folders) {
            const folder = normalizeVaultPath(rawFolder);
            if (folder && isPathInContextSourceFolder(path, folder)) {
                matches.push({
                    source,
                    folderLength: folder.length,
                    filterSpecificity: source.filter ? 1 : 0,
                    sourceIndex,
                });
            }
        }
    });
    matches.sort(
        (a, b) =>
            b.folderLength - a.folderLength ||
            b.filterSpecificity - a.filterSpecificity ||
            a.sourceIndex - b.sourceIndex,
    );
    return matches[0]?.source ?? null;
}

function matchesProperty(
    properties: Record<string, unknown> | undefined,
    filter: ContextSourceSettings["filter"],
): boolean {
    if (!filter) return true;
    const actual = properties?.[filter.property];
    const expected = filter.value.toLowerCase();
    if (Array.isArray(actual)) return actual.some((value) => String(value).toLowerCase() === expected);
    return actual !== undefined && String(actual).toLowerCase() === expected;
}

function normalizeVaultPath(path: string): string {
    return path
        .trim()
        .replace(/\\/g, "/")
        .replace(/^\/+|\/+$/g, "");
}
