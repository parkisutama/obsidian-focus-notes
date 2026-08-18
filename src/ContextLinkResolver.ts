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
const WIKILINK = /(?<!!)\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g;

/**
 * Resolves a link's raw target text (a decoded Markdown-link href, or a Wikilink target)
 * to a vault path, or null if it doesn't resolve. Implementations typically defer to
 * Obsidian's own `metadataCache.getFirstLinkpathDest`, so the same resolution the user's
 * configured link format (relative, shortest path, absolute, Wikilinks) produces is
 * honored, instead of one convention being hardcoded here.
 */
export type LinkDestinationResolver = (rawTarget: string, sourceFilePath: string) => string | null;

/**
 * Vault paths every ordinary Markdown link or Wikilink in `markdown` resolves to via
 * `resolveLinkDestination`. No note/source filtering — see resolveContextLinks for that.
 */
export function resolvedMarkdownLinkPaths(
    markdown: string,
    sourceFilePath: string,
    resolveLinkDestination: LinkDestinationResolver,
): string[] {
    const paths: string[] = [];
    const seen = new Set<string>();
    const addTarget = (path: string | null): void => {
        if (!path || seen.has(path)) return;
        seen.add(path);
        paths.push(path);
    };
    for (const match of markdown.matchAll(MARKDOWN_LINK)) {
        const decoded = decodeLinkHref(match[1] ?? "");
        if (decoded !== null) addTarget(resolveLinkDestination(decoded, sourceFilePath));
    }
    for (const match of markdown.matchAll(WIKILINK)) {
        addTarget(resolveLinkDestination((match[1] ?? "").trim(), sourceFilePath));
    }
    return paths;
}

/** Link destination paths present in `nextMarkdown` but not `originalMarkdown`. */
export function addedResolvedMarkdownLinkPaths(
    originalMarkdown: string,
    nextMarkdown: string,
    sourceFilePath: string,
    resolveLinkDestination: LinkDestinationResolver,
): string[] {
    const original = new Set(resolvedMarkdownLinkPaths(originalMarkdown, sourceFilePath, resolveLinkDestination));
    return resolvedMarkdownLinkPaths(nextMarkdown, sourceFilePath, resolveLinkDestination).filter(
        (path) => !original.has(path),
    );
}

/**
 * Resolve ordinary Markdown links and Wikilinks in a capture to enabled contextual objects.
 * The configured source order is the tie-breaker when equally specific folders overlap.
 */
export function resolveContextLinks(
    markdown: string,
    sourceFilePath: string,
    notes: ContextLinkNote[],
    sources: ContextSourceSettings[],
    resolveLinkDestination: LinkDestinationResolver,
): ContextDestination[] {
    return resolveContextPaths(
        resolvedMarkdownLinkPaths(markdown, sourceFilePath, resolveLinkDestination),
        notes,
        sources,
    );
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

function decodeLinkHref(rawDestination: string): string | null {
    const raw = rawDestination.replace(/^<|>$/g, "");
    if (!raw || /^[a-z][a-z\d+.-]*:/i.test(raw) || raw.startsWith("#") || raw.startsWith("//")) return null;
    const withoutFragment = raw.split(/[?#]/, 1)[0] ?? "";
    if (!withoutFragment) return null;
    try {
        return decodeURIComponent(withoutFragment);
    } catch {
        return null;
    }
}

/**
 * Pure fallback resolver: interprets `target` as a path relative to `sourceFilePath`'s
 * folder (or vault-root if it starts with "/"). Doesn't understand Wikilinks or Obsidian's
 * shortest-path resolution — use an Obsidian-metadataCache-backed resolver in production;
 * this exists for tests and any context without an `App` to resolve against.
 */
export function resolveRelativeLinkDestination(target: string, sourceFilePath: string): string | null {
    const sourceDirectory = normalizeVaultPath(sourceFilePath).split("/").slice(0, -1);
    const destination = target.startsWith("/")
        ? target.slice(1).split("/")
        : [...sourceDirectory, ...target.split("/")];
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
    return normalized.length > 0 ? normalized.join("/") : null;
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
