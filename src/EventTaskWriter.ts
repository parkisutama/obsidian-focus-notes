import { type App, type TFile, normalizePath } from "obsidian";
import type { EventTaskSettings, InsertPosition } from "./types";
import type { InboxRecord } from "./EventTaskFormState";
import { formatInboxEntry } from "./InboxMarkdown";
import { ensureFolderPath, isTFile } from "./utils";
import { formatEventTaskEntry } from "./EventTaskMarkdown";

/** Reference to a hub note, used to build a markdown link. */
export interface HubNoteRef {
    /** Display text for the markdown link (= event/task title). */
    title: string;
    /** Vault-relative path, e.g. "Notes/Team Meeting.md". */
    path: string;
}

export interface EventRecord {
    kind: "event";
    title: string;
    start: Date;
    end: Date;
    allDay: boolean;
    description: string;
    hubNoteRef: HubNoteRef | null;
}

export interface TaskRecord {
    kind: "task";
    title: string;
    due: Date | null;
    dueHasTime: boolean;
    /** Optional timeblock/timebox: a start–end window for focused work. */
    timebox: { start: Date; end: Date } | null;
    /** All reminder datetimes; multiple means periodic reminders. */
    reminders: Date[];
    description: string;
    hubNoteRef: HubNoteRef | null;
}

export type EventTaskRecord = EventRecord | TaskRecord;

export class EventTaskWriter {
    constructor(
        private app: App,
        private settings?: EventTaskSettings,
    ) {}

    async write(
        record: EventTaskRecord,
        targetFilePath: string,
        targetHeading: string,
        position: InsertPosition,
        detailNoteRef?: HubNoteRef | null,
    ): Promise<void> {
        const file = await this.resolveOrCreateFile(targetFilePath);
        await this.insertIntoFile(file, targetHeading, formatEventTaskEntry(record, detailNoteRef), position);
    }

    async writeInbox(
        record: InboxRecord,
        targetFilePath: string,
        targetHeading: string,
        position: InsertPosition,
    ): Promise<void> {
        const file = await this.resolveOrCreateFile(targetFilePath);
        await this.insertIntoFile(file, targetHeading, formatInboxEntry(record), position);
    }

    async createHubNote(title: string, record: EventTaskRecord, folder: string): Promise<TFile> {
        const filePath = await this.resolveNotePath(title, folder);
        const existing = this.app.vault.getAbstractFileByPath(filePath);
        if (isTFile(existing)) return existing;

        const content = `${this.buildFrontmatter(record)}\n\n# ${title}\n\n`;
        return this.app.vault.create(filePath, content);
    }

    async createDetailNote(
        title: string,
        record: EventTaskRecord,
        folder: string,
        targetPath: string,
        hubPath: string | null,
    ): Promise<TFile> {
        const filePath = await this.resolveNotePath(title, folder);
        const existing = this.app.vault.getAbstractFileByPath(filePath);
        if (isTFile(existing)) return existing;

        const fm = this.buildDetailFrontmatter(record, targetPath, hubPath);
        const body = this.buildBody(record);
        const content = `${fm}\n\n${body}\n`;
        return this.app.vault.create(filePath, content);
    }

    /**
     * Resolve a safe vault path for a new note inside `folder`.
     * Strips .md suffix from folder (in case user typed a file path by mistake),
     * creates intermediate folders if needed, and returns the full file path.
     */
    private async resolveNotePath(title: string, folder: string): Promise<string> {
        const safeName = title.replace(/[\\/:*?"<>|]/g, "_").trim() || "Untitled";
        // Strip accidental .md suffix and trailing slashes from folder path
        const cleanFolder = folder.replace(/\.md$/i, "").replace(/\/+$/, "").trim();
        const normalFolder = cleanFolder ? normalizePath(cleanFolder) : "";
        const filePath = normalFolder
            ? normalizePath(`${normalFolder}/${safeName}.md`)
            : normalizePath(`${safeName}.md`);

        if (normalFolder) {
            const existing = this.app.vault.getAbstractFileByPath(normalFolder);
            if (!existing) {
                await ensureFolderPath(this.app, normalFolder);
            } else if (isTFile(existing)) {
                // The path resolves to a file, not a folder — fall back to vault root
                return normalizePath(`${safeName}.md`);
            }
        }

        return filePath;
    }

    private buildFrontmatter(record: EventTaskRecord): string {
        const lines = ["---"];
        if (record.kind === "event") {
            lines.push("type: event");
            lines.push(`date: ${this.fmtDate(record.start)}`);
            if (!record.allDay) {
                lines.push(`start: "${this.fmtTime(record.start)}"`);
                lines.push(`end: "${this.fmtTime(record.end)}"`);
            }
        } else {
            lines.push("type: task");
            if (record.due) lines.push(`due: ${this.fmtDate(record.due)}`);
        }
        lines.push("---");
        return lines.join("\n");
    }

    private buildDetailFrontmatter(record: EventTaskRecord, targetPath: string, hubPath: string | null): string {
        const s = this.settings;
        const lines = ["---"];

        if (record.kind === "event") {
            lines.push("type: event");
            lines.push(`title: "${this.escapeYaml(record.title)}"`);
            lines.push(`date: ${this.fmtDate(record.start)}`);
            if (!record.allDay) {
                lines.push(`start: "${this.fmtTime(record.start)}"`);
                lines.push(`end: "${this.fmtTime(record.end)}"`);
            }
            if (s?.includeStatus ?? true) lines.push("status: scheduled");
            if (s?.includeTags ?? true) lines.push("tags: [event]");
        } else {
            lines.push("type: task");
            lines.push(`title: "${this.escapeYaml(record.title)}"`);
            if (record.due) lines.push(`due: ${this.fmtDate(record.due)}`);
            if (s?.includeStatus ?? true) lines.push("status: open");
            if (s?.includePriority ?? true) lines.push("priority: medium");
            if (s?.includeTags ?? true) lines.push("tags: [task]");
        }

        const relFmt = s?.relatedFieldFormat ?? "[[{{date}}]]";
        if (relFmt) {
            const dateStr =
                record.kind === "event"
                    ? this.fmtDate(record.start)
                    : record.due
                      ? this.fmtDate(record.due)
                      : this.fmtDate(new Date());
            const rel = this.expandTokens(relFmt, {
                date: dateStr,
                targetFile: targetPath.replace(/\.md$/, ""),
                title: record.title,
            });
            if (rel) lines.push(`related: "${this.escapeYaml(rel)}"`);
        }

        if (hubPath) {
            lines.push(`hub: "[[${this.escapeYaml(hubPath.replace(/\.md$/, ""))}]]"`);
        }

        lines.push("---");
        return lines.join("\n");
    }

    private buildBody(record: EventTaskRecord): string {
        const s = this.settings;
        const defaultTpl = "# {{title}}\n\n{{description}}";
        const template =
            record.kind === "event" ? s?.eventNoteTemplate || defaultTpl : s?.taskNoteTemplate || defaultTpl;

        const dateStr =
            record.kind === "event"
                ? this.fmtDate(record.start)
                : record.due
                  ? this.fmtDate(record.due)
                  : this.fmtDate(new Date());

        const tokens: Record<string, string> = {
            title: record.title,
            date: dateStr,
            description: record.description.trim(),
        };

        if (record.kind === "event") {
            tokens.start = record.allDay ? "" : this.fmtTime(record.start);
            tokens.end = record.allDay ? "" : this.fmtTime(record.end);
            tokens.due = "";
            tokens.remind = "";
        } else {
            tokens.due = record.due
                ? record.dueHasTime
                    ? this.fmtDateTime(record.due)
                    : this.fmtDate(record.due)
                : "";
            tokens.start = record.timebox ? this.fmtTime(record.timebox.start) : "";
            tokens.end = record.timebox ? this.fmtTime(record.timebox.end) : "";
            tokens.remind = record.reminders[0] ? this.fmtDateTime(record.reminders[0]) : "";
        }

        return this.expandTokens(template, tokens);
    }

    private expandTokens(template: string, tokens: Record<string, string>): string {
        return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => tokens[key] ?? "");
    }

    private escapeYaml(s: string): string {
        return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private fmtDate(d: Date): string {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    }

    private fmtTime(d: Date): string {
        return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }

    private fmtDateTime(d: Date): string {
        return `${this.fmtDate(d)} ${this.fmtTime(d)}`;
    }

    private async resolveOrCreateFile(filePath: string): Promise<TFile> {
        if (!filePath) throw new Error("No target file configured.");
        const path = normalizePath(filePath);
        const existing = this.app.vault.getAbstractFileByPath(path);
        if (isTFile(existing)) return existing;
        if (existing) throw new Error(`Target path is a folder: ${path}`);
        const parts = path.split("/");
        if (parts.length > 1) {
            const dir = parts.slice(0, -1).join("/");
            await ensureFolderPath(this.app, dir);
        }
        return this.app.vault.create(path, "");
    }

    private async insertIntoFile(
        file: TFile,
        heading: string,
        content: string,
        position: InsertPosition,
    ): Promise<void> {
        const original = await this.app.vault.read(file);
        const lines = original.split("\n");
        const cleanHeading = heading.replace(/^#+\s*/, "").trim();

        if (!cleanHeading) {
            const sep = !original || original.endsWith("\n") ? "" : "\n";
            await this.app.vault.modify(file, `${original}${sep}${content}\n`);
            return;
        }

        const info = this.findHeading(lines, cleanHeading);
        if (!info) {
            const sep = !original ? "" : original.endsWith("\n") ? "" : "\n";
            await this.app.vault.modify(file, `${original}${sep}\n## ${cleanHeading}\n\n${content}\n`);
            return;
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

        await this.app.vault.modify(file, lines.join("\n"));
    }

    private findHeading(
        lines: string[],
        target: string,
    ): { startIndex: number; endIndex: number; level: number } | null {
        const re = /^(#{1,6})\s+(.+?)\s*$/;
        const lower = target.toLowerCase();
        let foundIdx = -1,
            foundLevel = 0;
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
}
