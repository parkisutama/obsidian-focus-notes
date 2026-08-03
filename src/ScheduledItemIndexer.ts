import type { App, TFile } from "obsidian";
import type { ScheduledItemParser } from "./ScheduledItemParser";
import type { ScheduledItem, ScheduledItemSource } from "./ScheduledItemTypes";
import { isTFile } from "./utils.ts";
import { isFileInTimelineSource } from "./TimelineSourceAlignment.ts";

export class ScheduledItemIndexer {
    private readonly app: App;
    private readonly parser: ScheduledItemParser;

    constructor(app: App, parser: ScheduledItemParser) {
        this.app = app;
        this.parser = parser;
    }

    async buildIndex(sourceFolders: string[]): Promise<ScheduledItem[]> {
        const folders = sourceFolders.map((f) => f.trim()).filter(Boolean);
        const files = this.app.vault.getMarkdownFiles().filter((file) => this.isInSourceScope(file, folders));

        const items: ScheduledItem[] = [];
        for (const file of files) {
            const content = await this.app.vault.cachedRead(file);
            items.push(...this.parseFile(file, content));
        }
        return items;
    }

    private parseFile(file: TFile, content: string): ScheduledItem[] {
        const items: ScheduledItem[] = [];
        const headingPath: string[] = [];
        const lines = content.split(/\r?\n/);

        lines.forEach((line, idx) => {
            this.updateHeadingPath(line, headingPath);
            const source: ScheduledItemSource = {
                filePath: file.path,
                fileName: file.basename,
                lineNumber: idx + 1,
                headingPath: [...headingPath],
            };
            const item = this.parser.parseLine(line, source);
            if (item) items.push(item);
        });

        return items;
    }

    private updateHeadingPath(line: string, headingPath: string[]): void {
        const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
        if (!match) return;
        const level = match[1].length;
        headingPath.splice(level - 1);
        headingPath[level - 1] = match[2].trim();
    }

    private isInSourceScope(file: TFile, folders: string[]): boolean {
        if (!isTFile(file) || file.extension !== "md") return false;
        if (folders.length === 0) return false;
        return isFileInTimelineSource(file.path, folders);
    }
}
