import { App, Component, MarkdownRenderer } from "obsidian";
import { extractMarkdownLinks } from "./InboxLinkText";

/** Render relative links through Obsidian while keeping the editable value plain Markdown. */
export class InboxLinkPreview {
    private renderVersion = 0;

    constructor(
        private readonly app: App,
        private readonly owner: Component,
        private readonly container: HTMLElement
    ) {}

    update(markdown: string, sourcePath: string): void {
        const version = ++this.renderVersion;
        const links = extractMarkdownLinks(markdown);
        this.container.empty();
        this.container.toggleClass("fn-gcal-hidden", links.length === 0);
        if (links.length === 0) return;

        this.container.createSpan({ cls: "fn-inbox-link-preview-label", text: "Linked context" });
        const linksEl = this.container.createDiv({ cls: "fn-inbox-link-preview-links" });
        // Public renderer contract: https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts
        void MarkdownRenderer.render(
            this.app,
            links.join(" · "),
            linksEl,
            sourcePath,
            this.owner
        ).then(() => {
            if (version !== this.renderVersion) linksEl.remove();
        });
    }
}
