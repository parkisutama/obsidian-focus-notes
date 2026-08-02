import { type App, type EventRef, getAllTags, parseFrontMatterAliases, prepareFuzzySearch } from "obsidian";
import {
    buildMentionSuggestions,
    buildTagSuggestions,
    filterMentionSuggestions,
    InboxSuggestionSnapshot,
    ContextSuggestionIndex,
    type ContextSuggestion,
    type MentionSuggestion,
    type SuggestionMatcher,
    type SuggestionNote,
} from "./InboxSuggestions";
import type { ContextSourceSettings } from "./types";

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
    private readonly metadataEventRef: EventRef;
    private readonly vaultEventRefs: EventRef[];

    constructor(private app: App) {
        this.snapshot = new InboxSuggestionSnapshot(
            () => this.loadNotes(),
            () => this.loadTags(),
        );
        this.metadataEventRef = app.metadataCache.on("changed", () => this.invalidate());
        this.vaultEventRefs = [
            app.vault.on("create", () => this.invalidate()),
            app.vault.on("rename", () => this.invalidate()),
            app.vault.on("delete", () => this.invalidate()),
        ];
    }

    getContextSuggestions(query: string, sources: ContextSourceSettings[], limit = 20): ContextSuggestion[] {
        this.contextIndex ??= new ContextSuggestionIndex(this.snapshot.getNotes());
        return this.contextIndex.query(sources, this.matcher(query), limit);
    }

    getMentionSuggestions(
        query: string,
        peopleFolders: string[],
        placeFolders: string[],
        limit = 20,
    ): MentionSuggestion[] {
        const candidates = buildMentionSuggestions(this.snapshot.getNotes(), peopleFolders, placeFolders);
        return filterMentionSuggestions(candidates, this.matcher(query), limit);
    }

    getTagSuggestions(query: string, limit = 20): string[] {
        return buildTagSuggestions(this.snapshot.getTags(), this.matcher(query), limit);
    }

    destroy(): void {
        this.app.metadataCache.offref(this.metadataEventRef);
        for (const ref of this.vaultEventRefs) this.app.vault.offref(ref);
    }

    private invalidate(): void {
        this.snapshot.invalidate();
        this.contextIndex = null;
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
