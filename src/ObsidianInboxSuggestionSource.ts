import {
    App,
    getAllTags,
    parseFrontMatterAliases,
    prepareFuzzySearch
} from "obsidian";
import {
    buildMentionSuggestions,
    buildTagSuggestions,
    filterMentionSuggestions,
    MentionSuggestion,
    SuggestionMatcher,
    SuggestionNote
} from "./InboxSuggestions";

/** Read-only bridge from Obsidian's vault metadata to Inbox suggestion data. */
export class ObsidianInboxSuggestionSource {
    constructor(private app: App) {}

    getMentionSuggestions(
        query: string,
        peopleFolders: string[],
        placeFolders: string[],
        limit = 20
    ): MentionSuggestion[] {
        const notes: SuggestionNote[] = this.app.vault.getMarkdownFiles().map(file => {
            const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter ?? null;
            return {
                path: file.path,
                basename: file.basename,
                aliases: parseFrontMatterAliases(frontmatter) ?? []
            };
        });
        const candidates = buildMentionSuggestions(notes, peopleFolders, placeFolders);
        return filterMentionSuggestions(candidates, this.matcher(query), limit);
    }

    getTagSuggestions(query: string, limit = 20): string[] {
        const tags = this.app.vault.getMarkdownFiles().flatMap(file => {
            const cache = this.app.metadataCache.getFileCache(file);
            return cache ? (getAllTags(cache) ?? []) : [];
        });
        return buildTagSuggestions(tags, this.matcher(query), limit);
    }

    private matcher(query: string): SuggestionMatcher {
        if (!query.trim()) return () => 0;
        const search = prepareFuzzySearch(query);
        return text => search(text)?.score ?? null;
    }
}
