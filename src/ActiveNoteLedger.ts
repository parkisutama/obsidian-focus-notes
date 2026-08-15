import type { ScheduledItemParser } from "./ScheduledItemParser";
import type { ScheduledItem, ScheduledItemSource } from "./ScheduledItemTypes";

export function scanActiveNoteLedger(
    filePath: string,
    fileName: string,
    content: string,
    acceptedHeadings: readonly string[],
    parser: ScheduledItemParser,
): ScheduledItem[] {
    const accepted = new Set(acceptedHeadings.map((heading) => heading.trim().toLowerCase()).filter(Boolean));
    if (accepted.size === 0) return [];

    const items: ScheduledItem[] = [];
    const headingPath: string[] = [];
    for (const [index, line] of content.split(/\r?\n/).entries()) {
        updateHeadingPath(line, headingPath);
        if (!headingPath.some((heading) => accepted.has(heading.toLowerCase()))) continue;
        const source: ScheduledItemSource = {
            groupId: "active-note",
            groupName: "Active note",
            filePath,
            fileName,
            lineNumber: index + 1,
            headingPath: [...headingPath],
        };
        const item = parser.parseLine(line, source);
        if (item) items.push(item);
    }
    return items;
}

function updateHeadingPath(line: string, headingPath: string[]): void {
    const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!match) return;
    const level = match[1].length;
    headingPath.splice(level - 1);
    headingPath[level - 1] = match[2].trim();
}
