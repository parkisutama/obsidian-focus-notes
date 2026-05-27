import { App } from "obsidian";

export interface TimelineSourceSummary {
    filePath: string;
    fileName: string;
    count: number;
    color: string;
    visible: boolean;
}

export class TimelineSourceSidebar {
    constructor(
        private app: App,
        private parent: HTMLElement,
        private opts: {
            sources: TimelineSourceSummary[];
            collapsed: boolean;
            onToggleSource: (filePath: string, visible: boolean) => void;
            onToggleCollapsed: (collapsed: boolean) => void;
        }
    ) {}

    render(): void {
        this.parent.empty();
        this.parent.toggleClass("focus-timeline-sidebar-collapsed", this.opts.collapsed);

        const header = this.parent.createDiv({ cls: "focus-timeline-sidebar-header" });
        header.createEl("span", { text: "Sources" });

        if (this.opts.collapsed) return;

        const list = this.parent.createDiv({ cls: "focus-timeline-source-list" });
        if (this.opts.sources.length === 0) {
            list.createDiv({
                cls: "focus-timeline-empty",
                text: "No scheduled items found in configured folders."
            });
            return;
        }

        for (const source of this.opts.sources) {
            const row = list.createDiv({ cls: "focus-timeline-source-row" });
            row.style.setProperty("--focus-timeline-source-color", source.color);

            const toggle = row.createEl("input", { type: "checkbox" });
            toggle.checked = source.visible;
            toggle.addEventListener("change", () => {
                this.opts.onToggleSource(source.filePath, toggle.checked);
            });

            const label = row.createDiv({ cls: "focus-timeline-source-label" });
            label.createDiv({ cls: "focus-timeline-source-name", text: source.fileName });
            label.createDiv({ cls: "focus-timeline-source-path", text: source.filePath });
            row.createDiv({ cls: "focus-timeline-source-count", text: String(source.count) });
        }
    }
}
