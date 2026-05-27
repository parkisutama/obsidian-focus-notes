import { App, TFile, normalizePath } from "obsidian";
import { InsertPosition } from "./types";
import { isTFile } from "./utils";

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
    constructor(private app: App) {}

    async write(
        record: EventTaskRecord,
        targetFilePath: string,
        targetHeading: string,
        position: InsertPosition
    ): Promise<void> {
        const file = await this.resolveOrCreateFile(targetFilePath);
        const line =
            record.kind === "event"
                ? this.formatEventLine(record)
                : this.formatTaskLine(record);

        const desc = record.description.trim();
        const fullContent = desc ? `${line}\n    - ${desc}` : line;

        await this.insertIntoFile(file, targetHeading, fullContent, position);
    }

    async createHubNote(
        title: string,
        record: EventTaskRecord,
        folder: string
    ): Promise<TFile> {
        const safeName = (title.replace(/[\\/:*?"<>|]/g, "_").trim() || "Untitled");
        const normalFolder = normalizePath(folder.replace(/\/+$/, ""));
        const filePath = normalFolder
            ? normalizePath(`${normalFolder}/${safeName}.md`)
            : normalizePath(`${safeName}.md`);

        if (normalFolder && !this.app.vault.getAbstractFileByPath(normalFolder)) {
            await this.app.vault.createFolder(normalFolder).catch(() => {});
        }

        const existing = this.app.vault.getAbstractFileByPath(filePath);
        if (isTFile(existing)) return existing;

        const content = `${this.buildFrontmatter(record)}\n\n# ${title}\n\n`;
        return this.app.vault.create(filePath, content);
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

    // -------------------------------------------------------------------------
    // Line formatters
    // -------------------------------------------------------------------------

    private formatEventLine(record: EventRecord): string {
        // Title is always the event's own title; hub note becomes a relative
        // markdown link so the text stays visible in any MD reader/writer.
        const titlePart = record.hubNoteRef
            ? `[${record.title}](${this.encodePath(record.hubNoteRef.path)})`
            : record.title;

        if (record.allDay) {
            return `- ${this.fmtDate(record.start)} ${titlePart}`;
        }
        return `- ${this.fmtDateTime(record.start)} - ${this.fmtTime(record.end)} ${titlePart}`;
    }

    private formatTaskLine(record: TaskRecord): string {
        const titlePart = record.hubNoteRef
            ? `[${record.title}](${this.encodePath(record.hubNoteRef.path)})`
            : record.title;

        let line = `- [ ] ${titlePart}`;

        if (record.due) {
            const dueStr = record.dueHasTime
                ? this.fmtDateTime(record.due)
                : this.fmtDate(record.due);
            line += ` | due:${dueStr}`;
        }

        if (record.timebox) {
            line += ` | start:${this.fmtDateTime(record.timebox.start)}`;
            line += ` | end:${this.fmtDateTime(record.timebox.end)}`;
        }

        for (const remind of record.reminders) {
            line += ` | remind:${this.fmtDateTime(remind)}`;
        }

        return line;
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private encodePath(path: string): string {
        return path.replace(/ /g, "%20");
    }

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
            if (!this.app.vault.getAbstractFileByPath(dir)) {
                await this.app.vault.createFolder(dir).catch(() => {});
            }
        }
        return this.app.vault.create(path, "");
    }

    private async insertIntoFile(
        file: TFile,
        heading: string,
        content: string,
        position: InsertPosition
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
            await this.app.vault.modify(
                file,
                `${original}${sep}\n## ${cleanHeading}\n\n${content}\n`
            );
            return;
        }

        if (position === "start") {
            let blankIdx = info.startIndex + 1;
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
        target: string
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
