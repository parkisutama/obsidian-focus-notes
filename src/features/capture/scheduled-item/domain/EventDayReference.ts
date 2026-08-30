import {
    classifyScheduledItemBlockId,
    extractScheduledItemBlockId,
    formatScheduledItemBlockTarget,
} from "./ScheduledItemBlockId.ts";
import { removeMarkdownLineWithBlockId } from "./ScheduledItemLineRemoval.ts";

/** Local-calendar day key (YYYY-MM-DD), independent of time zone offsets or DST transitions. */
export function localDayKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function localDayStart(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Every local calendar day an Event's planned interval touches, inclusive and ascending.
 * Built from calendar fields (not millisecond arithmetic) so DST transitions never skip
 * or repeat a day. A single-day Event returns exactly one day.
 */
export function touchedLocalDays(start: Date, end: Date | null): Date[] {
    const from = localDayStart(start);
    const to = localDayStart(end ?? start);
    const days: Date[] = [];
    for (let cursor = from; cursor.getTime() <= to.getTime(); ) {
        days.push(cursor);
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
    }
    return days;
}

export interface EventDayReferenceFields {
    title: string;
    start: Date;
    end: Date | null;
    allDay: boolean;
    canonicalFilePath: string;
    canonicalBlockId: string;
    referenceBlockId: string;
}

export interface ParsedEventDayReference {
    title: string;
    start: string;
    end: string | null;
    allDay: boolean;
    canonicalTarget: string;
    referenceBlockId: string;
}

const TIMED_RE = /^-\s+(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\s+-\s+(\d{2}:\d{2})\s+(.+?)\s+\|\s+canonical:\[\[(.+?)\]\]$/;
const ALL_DAY_RE = /^-\s+(\d{4}-\d{2}-\d{2})\s+(.+?)\s+\|\s+canonical:\[\[(.+?)\]\]$/;

/**
 * Renders a derived, non-canonical Event day reference. Mirrors the canonical Event line's
 * date/title shape (see EventLineEditor) so it reads the same in a Daily Note, but carries an
 * `event-ref-*` block id (never `event-*`) plus a `canonical:` link back to the source block —
 * that block-id namespace is what lets parsers classify it as a reference before a canonical
 * entry, per the spec's Daily projection rules.
 */
export function formatEventDayReferenceLine(fields: EventDayReferenceFields): string {
    const target = formatScheduledItemBlockTarget(fields.canonicalFilePath, fields.canonicalBlockId);
    const header = fields.allDay
        ? `- ${fmtDate(fields.start)} ${fields.title}`
        : `- ${fmtDate(fields.start)} ${fmtTime(fields.start)} - ${fmtTime(fields.end ?? fields.start)} ${fields.title}`;
    return `${header} | canonical:[[${target}]] ^${fields.referenceBlockId}`;
}

export function parseEventDayReferenceLine(line: string): ParsedEventDayReference | null {
    const { semanticLine, blockId } = extractScheduledItemBlockId(line);
    if (!blockId || classifyScheduledItemBlockId(blockId) !== "event-reference") return null;
    const timed = semanticLine.match(TIMED_RE);
    if (timed) {
        const [, start, end, title, canonicalTarget] = timed;
        return { title, start, end, allDay: false, canonicalTarget, referenceBlockId: blockId };
    }
    const allDay = semanticLine.match(ALL_DAY_RE);
    if (!allDay) return null;
    const [, start, title, canonicalTarget] = allDay;
    return { title, start, end: null, allDay: true, canonicalTarget, referenceBlockId: blockId };
}

/**
 * Removes whichever line in `content` is an Event day reference pointing at `canonicalTarget`
 * (self-describing, so no separately stored day→blockId map is needed). A no-op when no such
 * reference exists, so callers can retry or rebuild without special-casing "already removed".
 */
export function removeEventDayReferenceForCanonical(content: string, canonicalTarget: string): string {
    const lines = content.split(/(?<=\n)/);
    for (const line of lines) {
        const parsed = parseEventDayReferenceLine(line.replace(/\n$/, ""));
        if (parsed && parsed.canonicalTarget === canonicalTarget) {
            return removeMarkdownLineWithBlockId(content, parsed.referenceBlockId);
        }
    }
    return content;
}

function fmtDate(d: Date): string {
    return localDayKey(d);
}

function fmtTime(d: Date): string {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
