import type { EventOccurrenceStatus } from "./ScheduledItemTypes";

export interface EventLineEdit {
    allDay: boolean;
    start: string;
    end: string | null;
    status: EventOccurrenceStatus;
    actual: { start: string; end: string } | null;
}

export type EventLineInvalidReason =
    | "not-event"
    | "duplicate-owned-field"
    | "invalid-marker"
    | "invalid-status"
    | "invalid-planned-interval"
    | "incomplete-actual"
    | "invalid-actual-interval"
    | "actual-without-completion";

export type ParseEventLineEditResult =
    | { status: "parsed"; edit: EventLineEdit }
    | { status: "invalid"; reason: EventLineInvalidReason };

export type EditEventLineResult =
    | { status: "ready"; line: string }
    | { status: "invalid"; reason: EventLineInvalidReason };

const OWNED_KEYS = new Set(["type", "all-day", "status", "actual-start", "actual-end"]);
const DATE = "\\d{4}-\\d{2}-\\d{2}";
const TIME = "\\d{2}:\\d{2}";
const DATETIME = `${DATE} ${TIME}`;
const TIMED_RE = new RegExp(`^-\\s+(${DATETIME})\\s+-\\s+((?:${DATE} )?${TIME})\\s+(.+)$`);
const ALL_DAY_RE = new RegExp(`^-\\s+(${DATE})\\s+(.+)$`);

interface EventStructure {
    allDay: boolean;
    start: string;
    end: string | null;
    title: string;
    metadata: string[];
}

function parseDateTime(value: string, dateOnly: boolean): Date | null {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?$/);
    if (!match || (!dateOnly && match[4] === undefined)) return null;
    const [year, month, day, hour, minute] = [match[1], match[2], match[3], match[4] ?? "0", match[5] ?? "0"].map(
        Number,
    );
    const result = new Date(year, month - 1, day, hour, minute);
    return result.getFullYear() === year &&
        result.getMonth() === month - 1 &&
        result.getDate() === day &&
        result.getHours() === hour &&
        result.getMinutes() === minute
        ? result
        : null;
}

function splitPayload(payload: string): { title: string; metadata: string[] } {
    const [title = "", ...metadata] = payload.split(" | ");
    return { title, metadata };
}

function parseStructure(line: string): EventStructure | null {
    const timed = line.match(TIMED_RE);
    if (timed) {
        const end = timed[2].includes(" ") ? timed[2] : `${timed[1].slice(0, 10)} ${timed[2]}`;
        return { allDay: false, start: timed[1], end, ...splitPayload(timed[3]) };
    }
    const allDay = line.match(ALL_DAY_RE);
    return allDay ? { allDay: true, start: allDay[1], end: null, ...splitPayload(allDay[2]) } : null;
}

function keyOf(segment: string): string | null {
    const separator = segment.indexOf(":");
    return separator === -1 ? null : segment.slice(0, separator).trim().toLowerCase();
}

function metadataValue(segment: string): string {
    return segment.slice(segment.indexOf(":") + 1).trim();
}

function validateEdit(edit: EventLineEdit): EventLineInvalidReason | null {
    const start = parseDateTime(edit.start, edit.allDay);
    if (!start || (edit.allDay && edit.end !== null)) return "invalid-planned-interval";
    if (!edit.allDay) {
        const end = edit.end ? parseDateTime(edit.end, false) : null;
        if (!end || end <= start) return "invalid-planned-interval";
    }
    if (edit.actual && edit.status !== "completed") return "actual-without-completion";
    if (edit.actual) {
        const actualStart = parseDateTime(edit.actual.start, false);
        const actualEnd = parseDateTime(edit.actual.end, false);
        if (!actualStart || !actualEnd || actualEnd <= actualStart) return "invalid-actual-interval";
    }
    return null;
}

export function parseEventLineEdit(line: string): ParseEventLineEditResult {
    const structure = parseStructure(line);
    if (!structure?.title) return { status: "invalid", reason: "not-event" };
    const values = new Map<string, string>();
    for (const segment of structure.metadata) {
        const key = keyOf(segment);
        if (!key || !OWNED_KEYS.has(key)) continue;
        if (values.has(key)) return { status: "invalid", reason: "duplicate-owned-field" };
        values.set(key, metadataValue(segment));
    }
    if (values.has("type") && values.get("type")?.toLowerCase() !== "event") {
        return { status: "invalid", reason: "invalid-marker" };
    }
    const explicitAllDay = values.get("all-day")?.toLowerCase() === "true";
    if (structure.allDay && (values.get("type")?.toLowerCase() !== "event" || !explicitAllDay)) {
        return { status: "invalid", reason: "not-event" };
    }
    if (!structure.allDay && values.has("all-day")) return { status: "invalid", reason: "invalid-marker" };

    const status = values.get("status")?.toLowerCase() ?? "planned";
    if (status !== "planned" && status !== "completed" && status !== "cancelled") {
        return { status: "invalid", reason: "invalid-status" };
    }
    const actualStart = values.get("actual-start") ?? null;
    const actualEnd = values.get("actual-end") ?? null;
    if (Boolean(actualStart) !== Boolean(actualEnd)) return { status: "invalid", reason: "incomplete-actual" };
    const edit: EventLineEdit = {
        allDay: structure.allDay,
        start: structure.start,
        end: structure.end,
        status,
        actual: actualStart && actualEnd ? { start: actualStart, end: actualEnd } : null,
    };
    const invalid = validateEdit(edit);
    return invalid ? { status: "invalid", reason: invalid } : { status: "parsed", edit };
}

export function editEventLine(line: string, edit: EventLineEdit): EditEventLineResult {
    return editEventLineWithOptionalTitle(line, null, edit);
}

export function editEventLineWithTitle(line: string, title: string, edit: EventLineEdit): EditEventLineResult {
    return editEventLineWithOptionalTitle(line, title, edit);
}

function editEventLineWithOptionalTitle(
    line: string,
    titleEdit: string | null,
    edit: EventLineEdit,
): EditEventLineResult {
    const parsed = parseEventLineEdit(line);
    if (parsed.status === "invalid") return parsed;
    const invalid = validateEdit(edit);
    if (invalid) return { status: "invalid", reason: invalid };
    const structure = parseStructure(line);
    if (!structure) return { status: "invalid", reason: "not-event" };
    const title = titleEdit === null ? structure.title : renderEditedTitle(structure.title, titleEdit);
    if (JSON.stringify(parsed.edit) === JSON.stringify(edit) && title === structure.title) {
        return { status: "ready", line };
    }
    const metadata = structure.metadata.filter((segment) => !OWNED_KEYS.has(keyOf(segment) ?? ""));
    const prefix = edit.allDay
        ? `- ${edit.start} ${title}`
        : `- ${edit.start} - ${formatEnd(edit.start, edit.end ?? "")} ${title}`;
    if (edit.allDay) metadata.push("type:event", "all-day:true");
    if (edit.status !== "planned") metadata.push(`status:${edit.status}`);
    if (edit.actual) metadata.push(`actual-start:${edit.actual.start}`, `actual-end:${edit.actual.end}`);
    return { status: "ready", line: [prefix, ...metadata].join(" | ") };
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

function formatEnd(start: string, end: string): string {
    return start.slice(0, 10) === end.slice(0, 10) ? end.slice(11) : end;
}
