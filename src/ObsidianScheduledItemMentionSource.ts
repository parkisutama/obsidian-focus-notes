import { type App, prepareFuzzySearch, type TFile } from "obsidian";
import {
    ScheduledItemMentionIndex,
    type ScheduledItemMentionCandidate,
    type ScheduledItemMentionRecord,
} from "./ScheduledItemMentionIndex.ts";
import { ScheduledItemParser } from "./ScheduledItemParser.ts";
import type { ScheduledItemKind, ScheduledItemSource } from "./ScheduledItemTypes.ts";

interface BlockCacheLike {
    position: { start: { line: number } };
}

const sharedSources = new WeakMap<App, ObsidianScheduledItemMentionSource>();

export function getScheduledItemMentionSource(app: App): ObsidianScheduledItemMentionSource {
    let source = sharedSources.get(app);
    if (!source) {
        source = new ObsidianScheduledItemMentionSource(app);
        sharedSources.set(app, source);
    }
    return source;
}

export class ObsidianScheduledItemMentionSource {
    private readonly index = new ScheduledItemMentionIndex();
    private readonly parser = new ScheduledItemParser();
    private loadPromise: Promise<void> | null = null;
    private rebuildPromise: Promise<void> | null = null;
    private loaded = false;
    private generation = 0;

    constructor(private readonly app: App) {}

    query(kind: ScheduledItemKind, query: string, limit: number, onReady: () => void): ScheduledItemMentionCandidate[] {
        if (!this.loaded) {
            void this.ensureLoaded().then(onReady);
            return [];
        }
        const search = query.trim() ? prepareFuzzySearch(query) : null;
        return this.index.query(kind, search ? (text) => search(text)?.score ?? null : () => 0, limit);
    }

    invalidate(): void {
        this.generation += 1;
        this.loaded = false;
        this.loadPromise = null;
    }

    rebuild(): Promise<void> {
        if (this.rebuildPromise) return this.rebuildPromise;
        this.invalidate();
        const rebuild = this.ensureLoaded();
        this.rebuildPromise = rebuild.finally(() => {
            this.rebuildPromise = null;
        });
        return this.rebuildPromise;
    }

    async refreshFile(file: TFile): Promise<void> {
        if (!this.loaded) return;
        if (this.relevantBlocks(file).length === 0) {
            this.index.removeFile(file.path);
            return;
        }
        await this.indexFile(file);
    }

    removeFile(filePath: string): void {
        if (this.loaded) this.index.removeFile(filePath);
    }

    private ensureLoaded(): Promise<void> {
        this.loadPromise ??= this.build(this.generation);
        return this.loadPromise;
    }

    private async build(generation: number): Promise<void> {
        const files = this.app.vault.getMarkdownFiles().filter((file) => this.relevantBlocks(file).length > 0);
        const indexed = await Promise.all(
            files.map(async (file) => ({ filePath: file.path, records: await this.readFileRecords(file) })),
        );
        if (generation === this.generation) {
            this.index.replaceAll(indexed);
            this.loaded = true;
        }
    }

    private async indexFile(file: TFile): Promise<void> {
        this.index.replaceFile(file.path, await this.readFileRecords(file));
    }

    private async readFileRecords(file: TFile): Promise<ScheduledItemMentionRecord[]> {
        const blocks = this.relevantBlocks(file);
        const content = await this.app.vault.cachedRead(file);
        const lines = content.split(/\r?\n/);
        return blocks.flatMap(([blockId, block]) => {
            const lineNumber = block.position.start.line + 1;
            const rawLine = lines[lineNumber - 1];
            if (!rawLine) return [];
            const source: ScheduledItemSource = {
                groupId: "mentions",
                groupName: "Mentions",
                filePath: file.path,
                fileName: file.basename,
                lineNumber,
                headingPath: [],
            };
            const item = this.parser.parseLine(rawLine, source);
            if (!item?.blockId || item.blockId !== blockId) return [];
            return [
                {
                    blockId,
                    kind: item.kind,
                    title: item.title,
                    completed: item.isCompleted,
                    status:
                        item.kind === "task"
                            ? item.isCompleted
                                ? "completed"
                                : "open"
                            : (item.eventStatus ?? "planned"),
                    lineNumber,
                },
            ];
        });
    }

    private relevantBlocks(file: TFile): Array<[string, BlockCacheLike]> {
        const cache = this.app.metadataCache.getFileCache(file) as { blocks?: Record<string, BlockCacheLike> } | null;
        return Object.entries(cache?.blocks ?? {}).filter(([id]) => /^(?:task|event|fn-task|fn-event)-/.test(id));
    }
}
