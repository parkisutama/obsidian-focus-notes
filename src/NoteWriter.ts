import { App, TFile, moment, normalizePath } from "obsidian";
import { FocusNotesSettings, FocusTarget, SessionRecord } from "./types";
import { isTFile } from "./utils";
import { getMood } from "./MoodReference";
import {
    getEmotionCategoryLabel,
    getStressLevelLabel
} from "./EmotionalWellbeingReference";

/**
 * Writes a SessionRecord into the chosen note.
 *
 * Two structural modes the writer supports:
 *   1. Flat   — every entry's date lives inside the bullet line as {{date}}.
 *               Insertion goes directly under the main heading.
 *   2. Group  — entries are organised under a date sub-heading inside the
 *               main heading. The writer creates the sub-heading on first
 *               use of a new day, then inserts inside it on subsequent
 *               sessions for that day.
 *
 * The two modes share token expansion and empty-sub-bullet pruning. Where
 * they diverge is the placement strategy in `insertIntoFile`.
 */
export class NoteWriter {
    constructor(private app: App, private settings: FocusNotesSettings) {}

    public async writeSession(record: SessionRecord, target: FocusTarget): Promise<void> {
        const file = await this.resolveOrCreateFile(target.file);
        const formatted = this.formatRecord(record);
        await this.insertIntoFile(file, target, formatted, record);
    }

    // -----------------------------------------------------------------------
    // Token expansion
    // -----------------------------------------------------------------------

    private formatRecord(record: SessionRecord): string {
        const startMom = moment(record.startTime);
        const endMom = moment(record.endTime);
        const dateStr = endMom.format(this.settings.dailyNoteFormat);

        const mood = getMood(record.moodKey);
        const stressLabel = getStressLevelLabel(record.stressLevel);
        const emotionCategoryLabel = getEmotionCategoryLabel(record.emotionCategory);
        const wellbeing = this.formatWellbeing(stressLabel, emotionCategoryLabel, mood);
        const links = record.links.trim();

        // split/join is safer than a regex because user-supplied notes may
        // contain regex metacharacters.
        const replacements: Record<string, string> = {
            "{{date}}": dateStr,
            "{{startTime}}": startMom.format("HH:mm"),
            "{{endTime}}": endMom.format("HH:mm"),
            "{{startISO}}": record.startTime.toISOString(),
            "{{endISO}}": record.endTime.toISOString(),
            "{{duration}}": this.formatDuration(record.durationSeconds),
            "{{durationSeconds}}": String(record.durationSeconds),
            "{{durationMinutes}}": String(Math.round(record.durationSeconds / 60)),
            "{{mode}}": record.mode,
            "{{task}}": record.task.trim() || "(untitled)",
            "{{notes}}": record.notes.trim(),
            "{{wellbeing}}": wellbeing,
            "{{stressLevel}}": record.stressLevel ?? "",
            "{{stressLabel}}": stressLabel,
            "{{emotionCategory}}": record.emotionCategory ?? "",
            "{{emotionCategoryName}}": emotionCategoryLabel,
            "{{emotionKey}}": mood?.key ?? "",
            "{{emotionName}}": mood?.name ?? "",
            "{{emotionEmoji}}": mood?.emoji ?? "",
            "{{emotionTag}}": mood ? `#emotion/${mood.key}` : "",
            // Mood — empty strings when the user skipped mood selection.
            // Kept as compatibility aliases for older user templates.
            "{{moodKey}}": mood?.key ?? "",
            "{{moodName}}": mood?.name ?? "",
            "{{moodEmoji}}": mood?.emoji ?? "",
            "{{moodTag}}": mood ? `#mood/${mood.key}` : "",
            "{{moodKeywords}}": mood ? mood.keywords.map(k => `#${k}`).join(" ") : "",
            "{{links}}": links
        };

        // Pick template based on grouping. Both share the same token set.
        const template = this.settings.groupByDate
            ? this.settings.logFormatGrouped
            : this.settings.logFormatFlat;

        let output = template;
        for (const [token, value] of Object.entries(replacements)) {
            output = output.split(token).join(value);
        }

        return this.pruneEmptyBullets(output);
    }

    /**
     * After token expansion, sub-bullets whose tokens were all empty become
     * lines like "    - " or "    -  — ". These read as garbage in the file
     * and confuse the recent-entries reader. Strip them.
     *
     * The check is conservative: only lines that match the "indented dash
     * with no real content" shape are pruned. Lines with any of (mood emoji,
     * letters, numbers, wikilink) are kept regardless of whitespace quirks.
     */
    private pruneEmptyBullets(rendered: string): string {
        const HAS_CONTENT = /[\p{L}\p{N}\[\]\p{Emoji_Presentation}\p{Extended_Pictographic}]/u;
        return rendered
            .split("\n")
            .filter(line => {
                // Top-level bullet (no leading whitespace before the dash) is
                // always kept — that's the main entry line.
                if (/^- /.test(line)) return true;
                // Indented sub-bullets: keep only if there's actual content
                // beyond bullet-decoration characters (-, —, whitespace).
                if (/^\s+- /.test(line)) {
                    const stripped = line.replace(/^\s+- /, "").replace(/—/g, "").trim();
                    return stripped.length > 0 && HAS_CONTENT.test(stripped);
                }
                return true;
            })
            .join("\n");
    }

    private formatWellbeing(
        stressLabel: string,
        emotionCategoryLabel: string,
        mood: ReturnType<typeof getMood>
    ): string {
        const parts: string[] = [];
        if (stressLabel) parts.push(`stress ${stressLabel}`);
        if (mood) {
            const category = emotionCategoryLabel ? ` (${emotionCategoryLabel})` : "";
            parts.push(`emotion ${mood.emoji} ${mood.name}${category}`);
        } else if (emotionCategoryLabel) {
            parts.push(`emotion ${emotionCategoryLabel}`);
        }
        return parts.length > 0 ? `Emotional Wellbeing: ${parts.join(" · ")}` : "";
    }

    private formatDuration(seconds: number): string {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}h ${m}m`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    }

    // -----------------------------------------------------------------------
    // File / folder resolution
    // -----------------------------------------------------------------------

    private async resolveOrCreateFile(filePath: string): Promise<TFile> {
        if (!filePath) {
            throw new Error("No target file set. Choose one in the sidebar or in settings.");
        }
        const path = normalizePath(filePath);
        const existing = this.app.vault.getAbstractFileByPath(path);
        if (isTFile(existing)) return existing;
        if (existing) {
            throw new Error(
                `Target path is a folder, not a file: ${path}. ` +
                    `Pick a markdown file (e.g. ${path}/index.md) or move the folder out of the way.`
            );
        }
        const parts = path.split("/");
        if (parts.length > 1) {
            const dir = parts.slice(0, -1).join("/");
            if (!this.app.vault.getAbstractFileByPath(dir)) {
                await this.app.vault.createFolder(dir).catch(() => {
                    /* race tolerant: folder may exist already. */
                });
            }
        }
        return this.app.vault.create(path, "");
    }

    // -----------------------------------------------------------------------
    // Insertion strategy: flat vs grouped
    // -----------------------------------------------------------------------

    private async insertIntoFile(
        file: TFile,
        target: FocusTarget,
        content: string,
        record: SessionRecord
    ): Promise<void> {
        const original = await this.app.vault.read(file);
        const lines = original.split("\n");
        const mainHeading = target.heading.replace(/^#+\s*/, "").trim();

        // No main heading at all — append to file end with a blank line.
        if (!mainHeading) {
            const sep = original.length === 0 || original.endsWith("\n") ? "" : "\n";
            await this.app.vault.modify(file, `${original}${sep}${content}\n`);
            return;
        }

        const mainInfo = this.findHeading(lines, mainHeading);

        if (!mainInfo) {
            // Main heading missing — create at end. If grouping, also create
            // today's sub-heading. Both with the conventional blank line.
            const sep = original.length === 0 ? "" : original.endsWith("\n") ? "" : "\n";
            let block = `${sep}\n## ${mainHeading}\n\n`;
            if (this.settings.groupByDate) {
                block += this.makeDateSubHeading(record) + "\n\n";
            }
            block += content + "\n";
            await this.app.vault.modify(file, original + block);
            return;
        }

        if (!this.settings.groupByDate) {
            // Flat mode — same logic as before, factored into a helper.
            this.insertUnderSection(lines, mainInfo, content, target.position);
            await this.app.vault.modify(file, lines.join("\n"));
            return;
        }

        // Grouped mode: find or create today's date sub-heading inside the
        // main section, then insert into that subsection.
        const dateHeadingText = this.makeDateSubHeadingText(record);
        const dateSubInfo = this.findSubHeading(
            lines,
            mainInfo,
            dateHeadingText,
            mainInfo.level
        );

        if (!dateSubInfo) {
            // Create date sub-heading. Insertion position determines placement:
            //   end → today's group goes at the bottom of the main section
            //   start → today's group goes at the top
            const newSubHeading = this.makeDateSubHeading(record);
            if (target.position === "start") {
                // Aim for: ## Main \n\n ### today \n\n content \n\n ### prev day \n ...
                let blankIdx = mainInfo.startIndex + 1;
                if (lines[blankIdx] === undefined || lines[blankIdx].trim() !== "") {
                    lines.splice(blankIdx, 0, "");
                    blankIdx++;
                }
                // Insert: blank, sub-heading, blank, content, blank
                lines.splice(blankIdx, 0, newSubHeading, "", content, "");
            } else {
                // End: append at section end. Add a separating blank line if
                // the previous section content is dense.
                const insertIdx = mainInfo.endIndex;
                const prefix =
                    insertIdx > mainInfo.startIndex + 1 &&
                    lines[insertIdx - 1] !== undefined &&
                    lines[insertIdx - 1].trim() !== ""
                        ? [""]
                        : [];
                lines.splice(insertIdx, 0, ...prefix, newSubHeading, "", content);
            }
            await this.app.vault.modify(file, lines.join("\n"));
            return;
        }

        // Today's sub-heading already exists — insert content inside it.
        this.insertUnderSection(lines, dateSubInfo, content, target.position);
        await this.app.vault.modify(file, lines.join("\n"));
    }

    private makeDateSubHeading(record: SessionRecord): string {
        const hashes = "#".repeat(this.settings.dateSubHeadingLevel);
        const text = this.makeDateSubHeadingText(record);
        return `${hashes} ${text}`;
    }

    private makeDateSubHeadingText(record: SessionRecord): string {
        const dateStr = moment(record.endTime).format(this.settings.dailyNoteFormat);
        return this.settings.dateSubHeadingTemplate.split("{{date}}").join(dateStr);
    }

    /**
     * Insert content into the body of a section, respecting `position` and
     * the "blank line after heading" convention. Mutates `lines` in place.
     */
    private insertUnderSection(
        lines: string[],
        info: { startIndex: number; endIndex: number; level: number },
        content: string,
        position: "start" | "end"
    ): void {
        if (position === "start") {
            let blankIdx = info.startIndex + 1;
            if (lines[blankIdx] === undefined || lines[blankIdx].trim() !== "") {
                lines.splice(blankIdx, 0, "");
            }
            lines.splice(blankIdx + 1, 0, content);
        } else {
            if (info.endIndex === info.startIndex + 1) {
                // Section is empty — give it a leading blank line for readability.
                lines.splice(info.endIndex, 0, "", content);
            } else {
                lines.splice(info.endIndex, 0, content);
            }
        }
    }

    // -----------------------------------------------------------------------
    // Heading finders
    // -----------------------------------------------------------------------

    private findHeading(
        lines: string[],
        targetHeading: string
    ): { startIndex: number; endIndex: number; level: number } | null {
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
        while (endIdx > foundIdx + 1 && lines[endIdx - 1].trim() === "") {
            endIdx--;
        }
        return { startIndex: foundIdx, endIndex: endIdx, level: foundLevel };
    }

    /**
     * Find a sub-heading inside an already-located parent section.
     * The match is scoped to lines between parent.startIndex+1 and parent.endIndex
     * so we don't accidentally match a "## Other section / ### 2026-04-28" elsewhere.
     */
    private findSubHeading(
        lines: string[],
        parent: { startIndex: number; endIndex: number; level: number },
        targetHeading: string,
        parentLevel: number
    ): { startIndex: number; endIndex: number; level: number } | null {
        const headingRegex = /^(#{1,6})\s+(.+?)\s*$/;
        const target = targetHeading.toLowerCase();

        let foundIdx = -1;
        let foundLevel = 0;
        for (let i = parent.startIndex + 1; i < parent.endIndex; i++) {
            const m = lines[i].match(headingRegex);
            if (!m) continue;
            const lvl = m[1].length;
            if (lvl <= parentLevel) continue; // safety — shouldn't happen given parent.endIndex
            if (m[2].trim().toLowerCase() === target) {
                foundIdx = i;
                foundLevel = lvl;
                break;
            }
        }
        if (foundIdx === -1) return null;

        let endIdx = parent.endIndex;
        for (let i = foundIdx + 1; i < parent.endIndex; i++) {
            const m = lines[i].match(headingRegex);
            if (m && m[1].length <= foundLevel) {
                endIdx = i;
                break;
            }
        }
        while (endIdx > foundIdx + 1 && lines[endIdx - 1].trim() === "") {
            endIdx--;
        }
        return { startIndex: foundIdx, endIndex: endIdx, level: foundLevel };
    }
}
