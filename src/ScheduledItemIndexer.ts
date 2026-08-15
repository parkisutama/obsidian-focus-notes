import type { App, TFile } from "obsidian";
import type { ScheduledItemParser } from "./ScheduledItemParser";
import type { ScheduledItem, ScheduledItemSource, TimelineSourceGroup } from "./ScheduledItemTypes";
import { matchTimelineSourceGroup } from "./TimelineSourceGroups.ts";
import { isTFile } from "./utils.ts";

export class ScheduledItemIndexer {
    private readonly app: App;
    private readonly parser: ScheduledItemParser;

    constructor(app: App, parser: ScheduledItemParser) {
        this.app = app;
        this.parser = parser;
    }

    async buildIndex(sourceGroups: TimelineSourceGroup[], acceptedHeadings: string[]): Promise<ScheduledItem[]> {
        const headings = new Set(acceptedHeadings.map((heading) => heading.trim().toLowerCase()).filter(Boolean));
        const files = this.app.vault.getMarkdownFiles().filter((file) => this.findSourceGroup(file, sourceGroups));

        const items: ScheduledItem[] = [];
        for (const file of files) {
            const content = await this.app.vault.cachedRead(file);
            const group = this.findSourceGroup(file, sourceGroups);
            if (group) items.push(...this.parseFile(file, content, group, headings));
        }
        return items;
    }

    private parseFile(
        file: TFile,
        content: string,
        group: TimelineSourceGroup,
        acceptedHeadings: ReadonlySet<string>,
    ): ScheduledItem[] {
        const items: ScheduledItem[] = [];
        const headingPath: string[] = [];
        const lines = content.split(/\r?\n/);

        lines.forEach((line, idx) => {
            this.updateHeadingPath(line, headingPath);
            const source: ScheduledItemSource = {
                groupId: group.id,
                groupName: group.name,
                filePath: file.path,
                fileName: file.basename,
                lineNumber: idx + 1,
                headingPath: [...headingPath],
            };
            if (!this.isAcceptedHeading(headingPath, acceptedHeadings)) return;
            const item = this.parser.parseLine(line, source);
            if (item && this.isTimelineEligible(item)) items.push(item);
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

    private findSourceGroup(file: TFile, groups: TimelineSourceGroup[]): TimelineSourceGroup | null {
        if (!isTFile(file) || file.extension !== "md") return null;
        const frontmatter = this.app.metadataCache?.getFileCache(file)?.frontmatter as
            | Record<string, unknown>
            | undefined;
        return matchTimelineSourceGroup(file.path, frontmatter, groups);
    }

    private isAcceptedHeading(headingPath: string[], acceptedHeadings: ReadonlySet<string>): boolean {
        return headingPath.some((heading) => acceptedHeadings.has(heading.toLowerCase()));
    }

    private isTimelineEligible(item: ScheduledItem): boolean {
        if (item.kind === "event") return true;
        return Boolean(item.start || item.end || item.due || item.remind);
    }
}
