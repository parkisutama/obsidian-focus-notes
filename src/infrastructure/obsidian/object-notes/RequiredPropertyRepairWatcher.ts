import type { App, TFile } from "obsidian";
import { contextSourceMatchesNote } from "../../../features/object-notes/domain/ContextSourceScope.ts";
import type { ContextSourceSettings } from "../../../features/object-notes/domain/ContextSourceSettings";
import { computeRequiredPropertyGaps } from "../../../features/object-notes/domain/RequiredPropertyGaps.ts";
import type { RequiredPropertySchema } from "../../../features/object-notes/domain/RequiredPropertySchema";
import type { WriteSuppressionTracker } from "../capture/WriteSuppressionTracker.ts";
import { resolveRequiredPropertyValue } from "./RequiredPropertyResolution.ts";

/**
 * Plugin-lifetime watcher: a Markdown file that matches an enabled Object Source and is opened or
 * saved gets any missing required property filled in, the same way "Repair Object Notes" would.
 * Every write goes through `tracker` so the "modify" event this triggers is never mistaken for a
 * genuine edit and re-processed (the same loop-prevention TaskReferenceCheckboxWatcher uses).
 */
export class RequiredPropertyRepairWatcher {
    private readonly app: App;
    private readonly getSources: () => readonly ContextSourceSettings[];
    private readonly tracker: WriteSuppressionTracker;

    constructor(app: App, getSources: () => readonly ContextSourceSettings[], tracker: WriteSuppressionTracker) {
        this.app = app;
        this.getSources = getSources;
        this.tracker = tracker;
    }

    async handleFile(file: TFile): Promise<void> {
        if (file.extension !== "md") return;
        if (this.tracker.isSuppressed(file.path)) return;

        const properties = this.app.metadataCache.getFileCache(file)?.frontmatter as
            | Record<string, unknown>
            | undefined;
        const gaps = new Map<string, RequiredPropertySchema>();
        for (const source of this.getSources()) {
            if (!source.enabled) continue;
            if (!contextSourceMatchesNote({ path: file.path, properties }, source)) continue;
            for (const entry of computeRequiredPropertyGaps(source, properties)) {
                if (!gaps.has(entry.property)) gaps.set(entry.property, entry);
            }
        }
        if (gaps.size === 0) return;

        const context = { title: file.basename, createdAt: new Date(file.stat.ctime), targetFile: file };
        const resolved = await Promise.all(
            Array.from(gaps.values()).map(
                async (entry) =>
                    [entry.property, await resolveRequiredPropertyValue(this.app, entry, context)] as const,
            ),
        );

        this.tracker.beginSuppress(file.path);
        try {
            await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
                for (const [property, value] of resolved) {
                    if (frontmatter[property] === undefined) frontmatter[property] = value;
                }
            });
        } finally {
            this.tracker.endSuppress(file.path);
        }
    }
}
