import { App, normalizePath } from "obsidian";
import { FocusTarget } from "./types";
import { isTFile } from "./utils";

/**
 * Reads back the user's recent log entries from the active target.
 *
 * Each session log now spans multiple lines (a top-level bullet plus indented
 * sub-bullets for mood/notes/links), so an "entry" here is a bundle of lines:
 * the main bullet plus any immediately-following indented sub-bullets, until
 * the next top-level bullet or heading appears.
 *
 * Group-by-date awareness: when entries live under date sub-headings, we walk
 * those sub-headings in document order, but still surface entries newest-first
 * for the sidebar feed. Position semantics (`start` vs `end`) apply within
 * each date group: entries are reversed inside the group when position="end"
 * so the most recent shows first regardless of insert direction.
 */
export interface RecentEntry {
    /** Joined text of the main bullet plus its sub-bullets. */
    text: string;
    /** Line number of the main bullet — for click-to-jump. */
    lineNumber: number;
}

export class RecentEntriesReader {
    constructor(private app: App) {}

    public async read(target: FocusTarget, limit: number): Promise<RecentEntry[]> {
        if (!target.file || limit <= 0) return [];

        const path = normalizePath(target.file);
        const abstract = this.app.vault.getAbstractFileByPath(path);
        if (!isTFile(abstract)) return [];

        const content = await this.app.vault.read(abstract);
        const lines = content.split("\n");

        const headingText = target.heading.replace(/^#+\s*/, "").trim();
        const mainRange = headingText
            ? this.findHeadingRange(lines, headingText)
            : { start: 0, end: lines.length, level: 0 };

        if (!mainRange) return [];

        // Collect entries from the main range. If sub-headings exist inside,
        // we walk into them; otherwise we read the main range directly.
        const subRanges = this.findChildHeadings(lines, mainRange);

        let entries: RecentEntry[];
        if (subRanges.length === 0) {
            entries = this.collectEntries(lines, mainRange.start, mainRange.end);
            // Order according to position semantics across the whole section.
            if (target.position === "end") entries.reverse();
        } else {
            // Group-by-date or any sub-headed structure: traverse sub-ranges
            // in document order, applying position semantics inside each group.
            // The natural order of the sub-headings determines outer order;
            // when position="end" the last sub-heading is "today" so we walk
            // sub-ranges in reverse for newest-first overall.
            const ordered = target.position === "end" ? [...subRanges].reverse() : subRanges;
            entries = [];
            for (const range of ordered) {
                const inside = this.collectEntries(lines, range.start, range.end);
                if (target.position === "end") inside.reverse();
                entries.push(...inside);
                if (entries.length >= limit) break;
            }
        }

        return entries.slice(0, limit);
    }

    /**
     * Bundle a section of lines into entries. An entry is a top-level bullet
     * (`- ...`) plus all immediately-following indented sub-bullets and blank
     * lines. The bundle terminates at the next top-level bullet or heading.
     */
    private collectEntries(lines: string[], start: number, end: number): RecentEntry[] {
        const result: RecentEntry[] = [];
        let i = start;
        while (i < end) {
            // Skip headings, blank lines, and section text that isn't part of an entry.
            if (!/^- /.test(lines[i])) {
                i++;
                continue;
            }
            const startLine = i;
            const buf: string[] = [lines[i]];
            i++;
            while (i < end) {
                const ln = lines[i];
                if (/^#+\s+/.test(ln)) break;
                if (/^- /.test(ln)) break;
                if (/^\s+- /.test(ln)) {
                    buf.push(ln);
                    i++;
                    continue;
                }
                if (ln.trim() === "") {
                    // Blank line — peek ahead. If the next line is another
                    // sub-bullet, swallow this blank as part of the entry.
                    // Otherwise treat it as the entry boundary.
                    let j = i + 1;
                    while (j < end && lines[j].trim() === "") j++;
                    if (j < end && /^\s+- /.test(lines[j])) {
                        buf.push(ln);
                        i++;
                        continue;
                    }
                    break;
                }
                // Continuation line of the main bullet (e.g. wrapped paragraph).
                buf.push(ln);
                i++;
            }
            result.push({
                text: buf.join("\n").trimEnd(),
                lineNumber: startLine
            });
        }
        return result;
    }

    /** Find immediate child headings of `parent` — one level deeper. */
    private findChildHeadings(
        lines: string[],
        parent: { start: number; end: number; level: number }
    ): Array<{ start: number; end: number; level: number }> {
        const headingRegex = /^(#{1,6})\s+/;
        const wantLevel = parent.level + 1;
        const ranges: Array<{ start: number; end: number; level: number }> = [];

        let i = parent.start + 1;
        while (i < parent.end) {
            const m = lines[i].match(headingRegex);
            if (m && m[1].length === wantLevel) {
                const startIdx = i;
                let endIdx = parent.end;
                for (let j = i + 1; j < parent.end; j++) {
                    const m2 = lines[j].match(headingRegex);
                    if (m2 && m2[1].length <= wantLevel) {
                        endIdx = j;
                        break;
                    }
                }
                ranges.push({ start: startIdx, end: endIdx, level: wantLevel });
                i = endIdx;
            } else {
                i++;
            }
        }
        return ranges;
    }

    private findHeadingRange(
        lines: string[],
        targetHeading: string
    ): { start: number; end: number; level: number } | null {
        const headingRegex = /^(#{1,6})\s+(.+?)\s*$/;
        const target = targetHeading.toLowerCase();

        let foundIdx = -1;
        let foundLevel = 0;
        for (let i = 0; i < lines.length; i++) {
            const m = lines[i].match(headingRegex);
            if (m && m[2].trim().toLowerCase() === target) {
                foundIdx = i;
                foundLevel = m[1].length;
                break;
            }
        }
        if (foundIdx === -1) return null;

        let endIdx = lines.length;
        for (let i = foundIdx + 1; i < lines.length; i++) {
            const m = lines[i].match(headingRegex);
            if (m && m[1].length <= foundLevel) {
                endIdx = i;
                break;
            }
        }
        return { start: foundIdx, end: endIdx, level: foundLevel };
    }
}
