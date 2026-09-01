import type { InboxRecord } from "./InboxRecord";
import { normalizeFlatBlockText } from "../../shared/domain/FlatBlockChildLine.ts";
import { formatReflectionNotesLine } from "../../shared/domain/FlatBlockChildLine.ts";
import { formatReflectionLabelLine, reflectionFieldsPresent } from "../../../reflection/domain/ReflectionBlockLine.ts";

export interface FormatInboxEntryOptions {
    /**
     * Write only the time (HH:mm) instead of the full date-time. Intended for
     * weekly-note captures, where the date is already carried by the per-day
     * heading and repeating it on every bullet is redundant.
     */
    timeOnly?: boolean;
    blockId?: string;
}

/** Format one Inbox capture as portable Markdown bullets. */
export function formatInboxEntry(record: InboxRecord, options: FormatInboxEntryOptions = {}): string {
    const timestamp = options.timeOnly ? formatLocalTime(record.capturedAt) : formatLocalMinute(record.capturedAt);
    const title = record.title.trim();
    const defaultTitle = record.defaultTitle.trim();
    const baseHeading = !title || title === defaultTitle ? `- ${timestamp}` : `- ${timestamp} — ${title}`;
    const heading = options.blockId ? `${baseHeading} ^${options.blockId}` : baseHeading;
    const description = normalizeFlatBlockText(record.body);
    const bodyLines = description ? [`    - description: ${description}`] : [];
    const reflection = {
        stressLevel: record.stressLevel ?? null,
        emotionCategory: record.emotionCategory ?? null,
        emotionKey: record.emotionKey ?? null,
    };
    if (reflectionFieldsPresent(reflection)) bodyLines.push(formatReflectionLabelLine("    ", reflection));
    const reflectionNotes = formatReflectionNotesLine("    ", record.reflectionNotes ?? "");
    if (reflectionNotes) bodyLines.push(reflectionNotes);

    return [heading, ...bodyLines].join("\n");
}

/**
 * Build an encoded path to `linkedFilePath` relative to the file containing
 * the Inbox entry. Both inputs are vault-relative Markdown file paths.
 */
export function relativeMarkdownPath(targetFilePath: string, linkedFilePath: string): string {
    const source = pathSegments(targetFilePath);
    const destination = pathSegments(linkedFilePath);
    const sourceDirectory = source.slice(0, -1);

    let common = 0;
    while (
        common < sourceDirectory.length &&
        common < destination.length &&
        sourceDirectory[common] === destination[common]
    ) {
        common++;
    }

    const relative = [...sourceDirectory.slice(common).map(() => ".."), ...destination.slice(common)];
    const usable = relative.length > 0 ? relative : destination.slice(-1);
    return usable.map(encodePathSegment).join("/");
}

/** Create an ordinary relative Markdown link for a selected mention. */
export function formatRelativeMarkdownLink(targetFilePath: string, linkedFilePath: string, label: string): string {
    return `[${escapeMarkdownLabel(label)}](${relativeMarkdownPath(targetFilePath, linkedFilePath)})`;
}

function formatLocalMinute(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day} ${formatLocalTime(date)}`;
}

function formatLocalTime(date: Date): string {
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    return `${hour}:${minute}`;
}

function pathSegments(path: string): string[] {
    return path.replace(/\\/g, "/").split("/").filter(Boolean);
}

function encodePathSegment(segment: string): string {
    if (segment === "..") return segment;
    return encodeURIComponent(segment).replace(
        /[!'()*]/g,
        (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
    );
}

function escapeMarkdownLabel(label: string): string {
    return label.replace(/\\/g, "\\\\").replace(/([[\]])/g, "\\$1");
}
