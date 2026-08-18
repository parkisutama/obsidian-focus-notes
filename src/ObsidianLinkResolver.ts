import type { App } from "obsidian";
import type { LinkDestinationResolver } from "./ContextLinkResolver.ts";

/**
 * Resolves link targets the way Obsidian itself would — honoring the user's configured
 * link format (relative, shortest path, absolute) and Wikilinks — instead of assuming one
 * convention. Backed by the same metadataCache lookup Obsidian uses for its own links.
 */
export function createObsidianLinkResolver(app: App): LinkDestinationResolver {
    return (rawTarget, sourceFilePath) =>
        app.metadataCache.getFirstLinkpathDest(rawTarget, sourceFilePath)?.path ?? null;
}
