import type { InsertPosition } from "./types";

/**
 * Pure heading-aware insertion logic shared by EventTaskWriter's write paths.
 * Kept free of Obsidian's vault I/O so heading/ordering behavior is unit-testable
 * without a real App/Vault (the `obsidian` package has no runtime outside Obsidian
 * itself, only type declarations).
 */
export function insertUnderHeading(
    original: string,
    heading: string,
    content: string,
    position: InsertPosition,
): string {
    const lines = original.split("\n");
    const cleanHeading = heading.replace(/^#+\s*/, "").trim();

    if (!cleanHeading) {
        const sep = !original || original.endsWith("\n") ? "" : "\n";
        return `${original}${sep}${content}\n`;
    }

    const info = findHeading(lines, cleanHeading);
    if (!info) {
        // A brand-new "## heading" always lands at the very end of the file
        // regardless of position — correct for "end" (new content trends
        // toward the bottom), but "start" should place it before whatever
        // other level-2 heading already leads the file (e.g. a weekly note's
        // per-day headings), so repeated new-heading creation keeps the
        // newest section on top, not just the newest bullet within one.
        const insertAt = position === "start" ? findFirstHeadingIndexAtLevel(lines, 2) : -1;
        if (insertAt !== -1) {
            spliceNewHeadingSection(lines, cleanHeading, content, insertAt);
            return lines.join("\n");
        }
        const sep = !original ? "" : original.endsWith("\n") ? "" : "\n";
        return `${original}${sep}\n## ${cleanHeading}\n\n${content}\n`;
    }

    if (position === "start") {
        const blankIdx = info.startIndex + 1;
        if (lines[blankIdx] === undefined || lines[blankIdx].trim() !== "") {
            lines.splice(blankIdx, 0, "");
        }
        lines.splice(blankIdx + 1, 0, content);
    } else {
        if (info.endIndex === info.startIndex + 1) {
            lines.splice(info.endIndex, 0, "", content);
        } else {
            lines.splice(info.endIndex, 0, content);
        }
    }

    return lines.join("\n");
}

/** Index of the first line that is a heading at exactly `level`, or -1 if none exists. */
function findFirstHeadingIndexAtLevel(lines: string[], level: number): number {
    const re = /^(#{1,6})\s+/;
    for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(re);
        if (m && m[1].length === level) return i;
    }
    return -1;
}

/** Splice a whole new "## heading" section into `lines` immediately before `insertAt`. */
function spliceNewHeadingSection(lines: string[], cleanHeading: string, content: string, insertAt: number): void {
    const needsLeadingBlank = insertAt > 0 && lines[insertAt - 1].trim() !== "";
    const block = [...(needsLeadingBlank ? [""] : []), `## ${cleanHeading}`, "", content, ""];
    lines.splice(insertAt, 0, ...block);
}

function findHeading(lines: string[], target: string): { startIndex: number; endIndex: number; level: number } | null {
    const re = /^(#{1,6})\s+(.+?)\s*$/;
    const lower = target.toLowerCase();
    let foundIdx = -1;
    let foundLevel = 0;
    for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(re);
        if (m && m[2].trim().toLowerCase() === lower) {
            foundIdx = i;
            foundLevel = m[1].length;
            break;
        }
    }
    if (foundIdx === -1) return null;
    let endIdx = lines.length;
    for (let i = foundIdx + 1; i < lines.length; i++) {
        const m = lines[i].match(re);
        if (m && m[1].length <= foundLevel) {
            endIdx = i;
            break;
        }
    }
    while (endIdx > foundIdx + 1 && lines[endIdx - 1].trim() === "") endIdx--;
    return { startIndex: foundIdx, endIndex: endIdx, level: foundLevel };
}
