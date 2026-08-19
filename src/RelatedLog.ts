import { formatRelativeMarkdownLink } from "./InboxMarkdown.ts";

export interface RelatedLogInput {
    kind: "inbox" | "event" | "task";
    title: string;
    occurredAt: Date;
    endedAt?: Date | null;
    allDay?: boolean;
    primaryFilePath: string;
    destinationFilePath: string;
    primaryLabel?: string;
    /**
     * Formats the backlink to the primary note. Defaults to a plain relative Markdown
     * link, which keeps this function pure and testable without an App; real callers
     * should inject createObsidianLinkFormatter(app) so the backlink honors the user's
     * configured link format instead.
     */
    formatSourceLink?: (targetFilePath: string, linkedFilePath: string, label: string) => string;
}

/** Format one immutable, self-contained contextual history entry. */
export function formatRelatedLog(input: RelatedLogInput): string {
    const timestamp = formatTemporalLabel(input);
    const title = input.title.replace(/\s+/g, " ").trim() || defaultTitle(input.kind);
    const formatLink = input.formatSourceLink ?? formatRelativeMarkdownLink;
    const sourceLink = formatLink(
        input.destinationFilePath,
        input.primaryFilePath,
        input.primaryLabel?.trim() || fileBasename(input.primaryFilePath),
    );
    return `- ${timestamp} — ${title} — ${sourceLink}`;
}

function fileBasename(path: string): string {
    const fileName = path.replace(/\\/g, "/").split("/").pop() ?? path;
    const withoutExtension = fileName.replace(/\.md$/i, "");
    try {
        return decodeURIComponent(withoutExtension) || "Source note";
    } catch {
        return withoutExtension || "Source note";
    }
}

function formatTemporalLabel(input: RelatedLogInput): string {
    const date = formatDate(input.occurredAt);
    if (input.allDay) return date;
    const start = formatTime(input.occurredAt);
    if (!input.endedAt) return `${date} ${start}`;
    const end = formatTime(input.endedAt);
    return formatDate(input.endedAt) === date
        ? `${date} ${start}–${end}`
        : `${date} ${start}–${formatDate(input.endedAt)} ${end}`;
}

function defaultTitle(kind: RelatedLogInput["kind"]): string {
    if (kind === "event") return "Untitled event";
    if (kind === "task") return "Untitled task";
    return "Inbox capture";
}

function formatDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatTime(date: Date): string {
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
