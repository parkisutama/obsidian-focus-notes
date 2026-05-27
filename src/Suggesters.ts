import { App, TFile, AbstractInputSuggest } from "obsidian";
import { isTFile } from "./utils";

/**
 * Markdown file path suggester.
 *
 * Filtered to .md only because NoteWriter writes plain markdown — pointing it
 * at a .canvas or other non-markdown file would silently corrupt the file.
 */
export class FileSuggest extends AbstractInputSuggest<TFile> {
    constructor(app: App, private inputEl: HTMLInputElement) {
        super(app, inputEl);
    }

    getSuggestions(query: string): TFile[] {
        const lower = query.toLowerCase();
        return this.app.vault
            .getMarkdownFiles()
            .filter(f => f.path.toLowerCase().includes(lower))
            .slice(0, 20);
    }

    renderSuggestion(file: TFile, el: HTMLElement): void {
        el.setText(file.path);
    }

    selectSuggestion(file: TFile): void {
        this.inputEl.value = file.path;
        this.inputEl.trigger("input");
        this.close();
    }
}

/**
 * Heading suggester scoped to the file currently named in another input.
 *
 * The dependency on the file path is passed as a thunk so suggestions stay
 * live as the user edits the file field — no need to wire change events
 * between the two inputs. The thunk receives no arguments and returns
 * whatever the caller considers "the file we're indexing into right now".
 */
export class HeadingSuggest extends AbstractInputSuggest<string> {
    constructor(
        app: App,
        private inputEl: HTMLInputElement,
        private getFilePath: () => string
    ) {
        super(app, inputEl);
    }

    getSuggestions(query: string): string[] {
        const path = this.getFilePath();
        if (!path) return [];
        const file = this.app.vault.getAbstractFileByPath(path);
        if (!isTFile(file)) return [];
        const cache = this.app.metadataCache.getFileCache(file);
        if (!cache?.headings) return [];
        const lower = query.toLowerCase();
        return cache.headings
            .map(h => h.heading)
            .filter(h => h.toLowerCase().includes(lower))
            .slice(0, 20);
    }

    renderSuggestion(heading: string, el: HTMLElement): void {
        el.setText(heading);
    }

    selectSuggestion(heading: string): void {
        this.inputEl.value = heading;
        this.inputEl.trigger("input");
        this.close();
    }
}
