import { unwrapMarkdownLinkLabel } from "./InboxMarkdown.ts";
import type { TaskPriority } from "./ScheduledItemTypes";

/** Wraps a plain date/time edit value (e.g. into a relative Markdown link) before it's written. */
export type FormatDateValue = (value: string) => string;

export interface TaskLineEdit {
    completed: boolean;
    priority: TaskPriority;
    due: string | null;
    timebox: { start: string; end: string } | null;
    reminders: string[];
}

export type EditTaskLineResult = { status: "ready"; line: string } | { status: "invalid"; reason: "not-task" };

export type TaskLineInvalidReason =
    | "not-task"
    | "duplicate-owned-field"
    | "invalid-priority"
    | "invalid-due"
    | "incomplete-timebox"
    | "invalid-timebox"
    | "invalid-reminder";

export type ParseTaskLineEditResult =
    | { status: "parsed"; edit: TaskLineEdit }
    | { status: "invalid"; reason: TaskLineInvalidReason };

type OwnedKey = "priority" | "due" | "start" | "end" | "remind";

const OWNED_KEYS: OwnedKey[] = ["priority", "due", "start", "end", "remind"];

function metadataKey(segment: string): string | null {
    const separator = segment.indexOf(":");
    return separator === -1 ? null : segment.slice(0, separator).trim().toLowerCase();
}

function metadataValue(segment: string): string {
    const separator = segment.indexOf(":");
    return separator === -1 ? "" : segment.slice(separator + 1).trim();
}

function desiredMetadata(edit: TaskLineEdit, formatDateValue?: FormatDateValue): Record<OwnedKey, string[]> {
    const link = (value: string): string => (formatDateValue ? formatDateValue(value) : value);
    return {
        priority: edit.priority === "normal" ? [] : [edit.priority],
        due: edit.due ? [link(edit.due)] : [],
        start: edit.timebox ? [link(edit.timebox.start)] : [],
        end: edit.timebox ? [link(edit.timebox.end)] : [],
        remind: edit.reminders.map(link),
    };
}

function parseLocalDateTime(value: string, allowDateOnly: boolean): Date | null {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?$/);
    if (!match || (!allowDateOnly && match[4] === undefined)) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4] ?? 0);
    const minute = Number(match[5] ?? 0);
    const date = new Date(year, month - 1, day, hour, minute);
    return date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day &&
        date.getHours() === hour &&
        date.getMinutes() === minute
        ? date
        : null;
}

export function parseTaskLineEdit(line: string): ParseTaskLineEditResult {
    const match = line.match(/^\s*-\s+\[( |x|X)\]\s+(.+)$/);
    if (!match) return { status: "invalid", reason: "not-task" };

    const segments = match[2].split(" | ");
    segments.shift();
    const values: Record<OwnedKey, string[]> = { priority: [], due: [], start: [], end: [], remind: [] };
    for (const segment of segments) {
        const key = metadataKey(segment);
        if (!key || !OWNED_KEYS.includes(key as OwnedKey)) continue;
        const raw = metadataValue(segment);
        values[key as OwnedKey].push(key === "priority" ? raw : unwrapMarkdownLinkLabel(raw));
    }
    if ([values.priority, values.due, values.start, values.end].some((owned) => owned.length > 1)) {
        return { status: "invalid", reason: "duplicate-owned-field" };
    }

    const priority = values.priority[0]?.toLowerCase() ?? "normal";
    if (!OWNED_PRIORITIES.has(priority)) return { status: "invalid", reason: "invalid-priority" };
    const due = values.due[0] ?? null;
    if (due && !parseLocalDateTime(due, true)) return { status: "invalid", reason: "invalid-due" };

    const start = values.start[0] ?? null;
    const end = values.end[0] ?? null;
    if (Boolean(start) !== Boolean(end)) return { status: "invalid", reason: "incomplete-timebox" };
    if (start && end) {
        const parsedStart = parseLocalDateTime(start, false);
        const parsedEnd = parseLocalDateTime(end, false);
        if (!parsedStart || !parsedEnd || parsedEnd <= parsedStart) {
            return { status: "invalid", reason: "invalid-timebox" };
        }
    }
    if (values.remind.some((value) => !parseLocalDateTime(value, false))) {
        return { status: "invalid", reason: "invalid-reminder" };
    }

    return {
        status: "parsed",
        edit: {
            completed: match[1].toLowerCase() === "x",
            priority: priority as TaskPriority,
            due,
            timebox: start && end ? { start, end } : null,
            reminders: values.remind,
        },
    };
}

const OWNED_PRIORITIES: ReadonlySet<string> = new Set(["high", "medium", "normal", "low"]);

export function editTaskLine(line: string, edit: TaskLineEdit, formatDateValue?: FormatDateValue): EditTaskLineResult {
    return editTaskLineWithOptionalTitle(line, null, edit, formatDateValue);
}

export function editTaskLineWithTitle(
    line: string,
    title: string,
    edit: TaskLineEdit,
    formatDateValue?: FormatDateValue,
): EditTaskLineResult {
    return editTaskLineWithOptionalTitle(line, title, edit, formatDateValue);
}

function editTaskLineWithOptionalTitle(
    line: string,
    titleEdit: string | null,
    edit: TaskLineEdit,
    formatDateValue?: FormatDateValue,
): EditTaskLineResult {
    const match = line.match(/^(\s*-\s+\[)( |x|X)(\]\s+)(.+)$/);
    if (!match) return { status: "invalid", reason: "not-task" };

    const segments = match[4].split(" | ");
    const originalTitle = segments.shift() ?? "";
    const title = titleEdit === null ? originalTitle : renderEditedTitle(originalTitle, titleEdit);
    const desired = desiredMetadata(edit, formatDateValue);
    const consumed: Record<OwnedKey, number> = { priority: 0, due: 0, start: 0, end: 0, remind: 0 };
    const metadata: string[] = [];
    const ownedPositions: number[] = [];
    const ownedRanks: number[] = [];

    for (const segment of segments) {
        const key = metadataKey(segment);
        if (!key || !OWNED_KEYS.includes(key as OwnedKey)) {
            metadata.push(segment);
            continue;
        }

        const ownedKey = key as OwnedKey;
        const index = consumed[ownedKey];
        const value = desired[ownedKey][index];
        consumed[ownedKey] += 1;
        if (value === undefined) {
            if (
                ownedKey === "priority" &&
                edit.priority === "normal" &&
                metadataValue(segment).toLowerCase() === "normal"
            ) {
                ownedPositions.push(metadata.length);
                ownedRanks.push(OWNED_KEYS.indexOf(ownedKey));
                metadata.push(segment);
            }
            continue;
        }

        const currentValue = metadataValue(segment);
        const unchanged = ownedKey === "priority" ? currentValue.toLowerCase() === value : currentValue === value;
        ownedPositions.push(metadata.length);
        ownedRanks.push(OWNED_KEYS.indexOf(ownedKey));
        metadata.push(unchanged ? segment : `${ownedKey}:${value}`);
    }

    for (const key of OWNED_KEYS) {
        for (const value of desired[key].slice(consumed[key])) metadata.push(`${key}:${value}`);
    }

    // Re-sort the owned segments that already had a position into the canonical
    // priority/due/start/end/remind order, matching TaskLineLint's normalization,
    // so saving a "needs format" line (even with no field changes) fixes its order.
    const ownedTexts = ownedPositions.map((position) => metadata[position]);
    const order = ownedPositions
        .map((_, sequenceIndex) => sequenceIndex)
        .sort((a, b) => ownedRanks[a] - ownedRanks[b] || a - b);
    ownedPositions.forEach((position, sequenceIndex) => {
        metadata[position] = ownedTexts[order[sequenceIndex]];
    });

    const checkbox = edit.completed ? "x" : " ";
    const originalCheckboxMatches = (match[2].toLowerCase() === "x") === edit.completed;
    const checkboxValue = originalCheckboxMatches ? match[2] : checkbox;
    const payload = [title, ...metadata].join(" | ");
    return { status: "ready", line: `${match[1]}${checkboxValue}${match[3]}${payload}` };
}

function renderEditedTitle(original: string, title: string): string {
    const markdown = original.match(/^\[([^\]]*)\]\(([^)]+)\)$/);
    if (markdown) return markdown[1] === title ? original : `[${title}](${markdown[2]})`;
    const wiki = original.match(/^\[\[([^|\]]+)(?:\|([^\]]*))?\]\]$/);
    if (wiki) {
        const displayed = wiki[2] ?? wiki[1].split("/").pop()?.replace(/\.md$/i, "") ?? wiki[1];
        return displayed === title ? original : `[[${wiki[1]}|${title}]]`;
    }
    return original === title ? original : title;
}
