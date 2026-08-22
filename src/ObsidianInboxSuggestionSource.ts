import { type App, type EventRef, getAllTags, parseFrontMatterAliases, prepareFuzzySearch } from "obsidian";
import {
    buildTagSuggestions,
    InboxSuggestionSnapshot,
    ContextSuggestionIndex,
    type ContextSuggestion,
    type SuggestionMatcher,
    type SuggestionNote,
} from "./InboxSuggestions";
import type { ContextSourceSettings } from "./types";
import { getScheduledItemMentionSource } from "./ObsidianScheduledItemMentionSource.ts";
import type { ScheduledItemKind } from "./ScheduledItemTypes.ts";

export function readContextSuggestionNotes(app: App): SuggestionNote[] {
    return app.vault.getMarkdownFiles().map((file) => {
        const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter ?? null;
        return {
            path: file.path,
            basename: file.basename,
            aliases: parseFrontMatterAliases(frontmatter) ?? [],
            properties: frontmatter ?? {},
        };
    });
}

/** Read-only bridge from Obsidian's vault metadata to Inbox suggestion data. */
export class ObsidianInboxSuggestionSource {
    private readonly snapshot: InboxSuggestionSnapshot;
    private contextIndex: ContextSuggestionIndex | null = null;
    private readonly metadataEventRefs: EventRef[];
    private readonly vaultEventRefs: EventRef[];
    private readonly scheduledItemReadyCallbacks = new Set<() => void>();

    constructor(private app: App) {
        this.snapshot = new InboxSuggestionSnapshot(
            () => this.loadNotes(),
            () => this.loadTags(),
        );
        this.metadataEventRefs = [
            app.metadataCache.on("changed", (file) => {
                this.invalidateContext();
                void getScheduledItemMentionSource(this.app)
                    .refreshFile(file)
                    .then(() => this.notifyScheduledItemsReady());
            }),
            app.metadataCache.on("resolved", () => {
                void getScheduledItemMentionSource(this.app)
                    .rebuild()
                    .then(() => this.notifyScheduledItemsReady());
            }),
        ];
        this.vaultEventRefs = [
            app.vault.on("create", (file) => {
                this.invalidateContext();
                if ("extension" in file) {
                    void getScheduledItemMentionSource(this.app).refreshFile(file as import("obsidian").TFile);
                }
            }),
            app.vault.on("rename", (file, oldPath) => {
                this.invalidateContext();
                const mentions = getScheduledItemMentionSource(this.app);
                mentions.removeFile(oldPath);
                if ("extension" in file) void mentions.refreshFile(file as import("obsidian").TFile);
            }),
            app.vault.on("delete", (file) => {
                this.invalidateContext();
                getScheduledItemMentionSource(this.app).removeFile(file.path);
            }),
        ];
    }

    getContextSuggestions(query: string, sources: ContextSourceSettings[], limit = 20): ContextSuggestion[] {
        this.contextIndex ??= new ContextSuggestionIndex(this.snapshot.getNotes());
        return this.contextIndex.query(sources, this.matcher(query), limit);
    }

    getTagSuggestions(query: string, limit = 20): string[] {
        return buildTagSuggestions(this.snapshot.getTags(), this.matcher(query), limit);
    }

    getScheduledItemSuggestions(kind: ScheduledItemKind, query: string, limit: number, onReady: () => void) {
        this.scheduledItemReadyCallbacks.add(onReady);
        return getScheduledItemMentionSource(this.app).query(kind, query, limit, onReady);
    }

    destroy(): void {
        for (const ref of this.metadataEventRefs) this.app.metadataCache.offref(ref);
        for (const ref of this.vaultEventRefs) this.app.vault.offref(ref);
        this.scheduledItemReadyCallbacks.clear();
    }

    private invalidateContext(): void {
        this.snapshot.invalidate();
        this.contextIndex = null;
    }

    private notifyScheduledItemsReady(): void {
        for (const callback of this.scheduledItemReadyCallbacks) callback();
    }

    private loadNotes(): SuggestionNote[] {
        return readContextSuggestionNotes(this.app);
    }

    private loadTags(): string[] {
        return this.app.vault.getMarkdownFiles().flatMap((file) => {
            const cache = this.app.metadataCache.getFileCache(file);
            return cache ? (getAllTags(cache) ?? []) : [];
        });
    }

    private matcher(query: string): SuggestionMatcher {
        if (!query.trim()) return () => 0;
        const search = prepareFuzzySearch(query);
        return (text) => search(text)?.score ?? null;
    }
}
