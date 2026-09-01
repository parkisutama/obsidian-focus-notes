import type { App, TFile } from "obsidian";
import type {
    ScheduledItem,
    ScheduledItemFocusSession,
    ScheduledItemSource,
} from "../../../features/capture/scheduled-item/domain/ScheduledItem";
import type { ScheduledItemParser } from "../../../features/capture/scheduled-item/domain/ScheduledItemParser";
import {
    captureLedgerRecord,
    type CaptureLedgerRecordResult,
} from "../../../features/capture/scheduled-item/domain/LedgerRecordSource.ts";
import { parseScheduledItemBlock } from "../../../features/capture/scheduled-item/domain/ScheduledItemBlockEditor.ts";
import { parseLocalDateTime } from "../../../features/capture/scheduled-item/domain/ScheduledItemFormAdapter.ts";
import {
    type ScannedFocusSession,
    scanFocusSessionsInBlock,
} from "../../../features/focus-session/domain/FocusSessionBlockScan.ts";
import type { TimelineSourceGroup } from "../../../features/timeline/domain/Timeline";
import { matchTimelineSourceGroup } from "../../../features/timeline/domain/TimelineSourceGroups.ts";
import { isTFile } from "../vault/ObsidianFileTypes.ts";

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
            if (!item || !this.isTimelineEligible(item)) return;

            const captured = captureLedgerRecord(content, {
                filePath: source.filePath,
                lineNumber: source.lineNumber,
                rawLine: line,
            });
            const scanned = captured.status === "captured" ? scanFocusSessionsInBlock(captured.snapshot.rawBlock) : [];

            if (item.kind === "task") {
                items.push({ ...item, focusSessions: this.toItemFocusSessions(item.id, scanned) });
                items.push(...this.expandTaskTimeboxes(item, captured));
            } else {
                items.push({
                    ...item,
                    focusSessions: this.toItemFocusSessions(item.id, scanned),
                });
            }
        });

        return items;
    }

    /**
     * A Task's own line stays one item for its due chip; each child timebox (Task 33's grammar)
     * becomes an additional item sharing the Task's itemId but carrying a distinct timeboxId, so
     * every planned occurrence gets its own stable Timeline segment identity. Actual Focus
     * Sessions (Task 43's grammar) attach to whichever timebox they're nested under.
     */
    private expandTaskTimeboxes(taskItem: ScheduledItem, captured: CaptureLedgerRecordResult): ScheduledItem[] {
        if (captured.status !== "captured") return [];
        const parsed = parseScheduledItemBlock(captured.snapshot.rawBlock);
        if (parsed.status !== "parsed") return [];

        return parsed.block.timeboxes.flatMap((timebox) => {
            const start = parseLocalDateTime(timebox.start, false);
            const end = parseLocalDateTime(timebox.end, false);
            if (!start || !end) return [];
            return [
                {
                    ...taskItem,
                    timeboxId: timebox.timeboxId,
                    timeboxStatus: timebox.status,
                    start,
                    end,
                    allDay: false,
                    focusSessions: [],
                },
            ];
        });
    }

    private toItemFocusSessions(ownerItemId: string, scanned: ScannedFocusSession[]): ScheduledItemFocusSession[] {
        return scanned.flatMap((session) => {
            const start = parseLocalDateTime(session.start, false);
            const end = parseLocalDateTime(session.end, false);
            if (!start || !end) return [];
            return [
                {
                    sessionId: session.sessionId,
                    ownerItemId,
                    start,
                    end,
                    durationSeconds: session.durationSeconds,
                    mode: session.mode,
                    stressLevel: session.stressLevel,
                    emotionCategory: session.emotionCategory,
                    emotionKey: session.emotionKey,
                    notes: session.notes,
                },
            ];
        });
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
