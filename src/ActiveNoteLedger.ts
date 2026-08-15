import type { ScheduledItemParser } from "./ScheduledItemParser";
import type { ScheduledItem, ScheduledItemSource } from "./ScheduledItemTypes";

export interface ActiveNoteHeadingScope {
    id: string;
    label: string;
    headingPath: string[];
    items: ScheduledItem[];
}

export interface ActiveNoteChecklistScopes {
    allItems: ScheduledItem[];
    headings: ActiveNoteHeadingScope[];
}

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

export function scanActiveNoteChecklistScopes(
    filePath: string,
    fileName: string,
    content: string,
    parser: ScheduledItemParser,
): ActiveNoteChecklistScopes {
    const allItems: ScheduledItem[] = [];
    const headings: ActiveNoteHeadingScope[] = [];
    const activeHeadings: Array<{ level: number; scope: ActiveNoteHeadingScope }> = [];

    for (const [index, line] of content.split(/\r?\n/).entries()) {
        const heading = parseHeading(line);
        if (heading) {
            while (activeHeadings.at(-1) && (activeHeadings.at(-1)?.level ?? 0) >= heading.level) {
                activeHeadings.pop();
            }
            const headingPath = [...activeHeadings.map(({ scope }) => scope.headingPath.at(-1) ?? ""), heading.text];
            const scope: ActiveNoteHeadingScope = {
                id: `heading:${index + 1}`,
                label: headingPath.join(" / "),
                headingPath,
                items: [],
            };
            activeHeadings.push({ level: heading.level, scope });
            headings.push(scope);
            continue;
        }

        const source = buildSource(
            filePath,
            fileName,
            index + 1,
            activeHeadings.map(({ scope }) => scope.headingPath.at(-1) ?? ""),
        );
        const item = parser.parseLine(line, source);
        if (item?.kind !== "task") continue;
        allItems.push(item);
        for (const { scope } of activeHeadings) scope.items.push(item);
    }

    return { allItems, headings: headings.filter((scope) => scope.items.length > 0) };
}

function updateHeadingPath(line: string, headingPath: string[]): void {
    const heading = parseHeading(line);
    if (!heading) return;
    headingPath.splice(heading.level - 1);
    headingPath[heading.level - 1] = heading.text;
}

function parseHeading(line: string): { level: number; text: string } | null {
    const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    return match ? { level: match[1].length, text: match[2].trim() } : null;
}

function buildSource(
    filePath: string,
    fileName: string,
    lineNumber: number,
    headingPath: string[],
): ScheduledItemSource {
    return {
        groupId: "active-note",
        groupName: "Active note",
        filePath,
        fileName,
        lineNumber,
        headingPath,
    };
}
