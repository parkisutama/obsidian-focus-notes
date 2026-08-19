import type { App } from "obsidian";
import type { LinkDestinationResolver } from "./ContextLinkResolver.ts";
import { formatRelativeMarkdownLink } from "./InboxMarkdown.ts";
import { isTFile } from "./utils.ts";

/**
 * Resolves link targets the way Obsidian itself would — honoring the user's configured
 * link format (relative, shortest path, absolute) and Wikilinks — instead of assuming one
 * convention. Backed by the same metadataCache lookup Obsidian uses for its own links.
 */
export function createObsidianLinkResolver(app: App): LinkDestinationResolver {
    return (rawTarget, sourceFilePath) =>
        app.metadataCache.getFirstLinkpathDest(rawTarget, sourceFilePath)?.path ?? null;
}

/**
 * Formats a link the way Obsidian itself would (honoring the user's configured link format
 * and Wikilinks setting) via the official fileManager.generateMarkdownLink API, falling back
 * to a plain relative Markdown link when the target can't be resolved to an existing file
 * (e.g. a daily note for a future date that hasn't been created yet).
 */
export function createObsidianLinkFormatter(
    app: App,
): (targetFilePath: string, linkedFilePath: string, label: string) => string {
    return (targetFilePath, linkedFilePath, label) => {
        const file = app.vault.getAbstractFileByPath(linkedFilePath);
        return isTFile(file)
            ? app.fileManager.generateMarkdownLink(file, targetFilePath, undefined, label)
            : formatRelativeMarkdownLink(targetFilePath, linkedFilePath, label);
    };
}
