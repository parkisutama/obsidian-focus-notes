import type { App } from "obsidian";
import { contextSourceMatchesNote } from "../../../features/object-notes/domain/ContextSourceScope.ts";
import type { ContextSourceSettings } from "../../../features/object-notes/domain/ContextSourceSettings";
import { computeRequiredPropertyGaps } from "../../../features/object-notes/domain/RequiredPropertyGaps.ts";
import type { RequiredPropertySchema } from "../../../features/object-notes/domain/RequiredPropertySchema";
import { resolveRequiredPropertyValue } from "./RequiredPropertyResolution.ts";

export interface RepairObjectNotesSummary {
    filesRepaired: number;
    propertiesAdded: number;
}

/**
 * Additive-only vault-wide pass: a note matching one or more enabled Object Sources gets every
 * missing required property filled from its resolved default. Never rewrites an existing value,
 * so it is safe to run repeatedly and does not fight Obsidian Linter's own formatting passes.
 */
export async function repairObjectNoteProperties(
    app: App,
    sources: readonly ContextSourceSettings[],
): Promise<RepairObjectNotesSummary> {
    const enabledSources = sources.filter((source) => source.enabled);
    let filesRepaired = 0;
    let propertiesAdded = 0;

    for (const file of app.vault.getMarkdownFiles()) {
        const properties = app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
        const gaps = new Map<string, RequiredPropertySchema>();
        for (const source of enabledSources) {
            if (!contextSourceMatchesNote({ path: file.path, properties }, source)) continue;
            for (const entry of computeRequiredPropertyGaps(source, properties)) {
                if (!gaps.has(entry.property)) gaps.set(entry.property, entry);
            }
        }
        if (gaps.size === 0) continue;

        const context = { title: file.basename, createdAt: new Date(file.stat.ctime), targetFile: file };
        const resolved = await Promise.all(
            Array.from(gaps.values()).map(
                async (entry) => [entry.property, await resolveRequiredPropertyValue(app, entry, context)] as const,
            ),
        );
        await app.fileManager.processFrontMatter(file, (frontmatter) => {
            for (const [property, value] of resolved) {
                if (frontmatter[property] === undefined) frontmatter[property] = value;
            }
        });
        filesRepaired += 1;
        propertiesAdded += resolved.length;
    }

    return { filesRepaired, propertiesAdded };
}
