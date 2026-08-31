import {
    classifyScheduledItemBlockId,
    extractScheduledItemBlockId,
} from "../../capture/scheduled-item/domain/ScheduledItemBlockId.ts";

/**
 * ISO week key (GGGG-Www), independent of time zone offsets or DST transitions. Used only as an
 * in-memory de-dup key while projecting a session's touched days into weeks — never written to
 * disk, so it doesn't need to match the user's configured weekly file-name format exactly.
 */
export function localWeekKey(date: Date): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const isoWeekday = d.getUTCDay() || 7; // Monday=1 .. Sunday=7
    d.setUTCDate(d.getUTCDate() + 4 - isoWeekday); // Thursday of this ISO week
    const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
    const weekNumber = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

export interface FocusSessionWeekReferenceFields {
    /** The owning Event/Task's title, used both as display text and as the wikilink alias. */
    title: string;
    start: Date;
    end: Date;
    /** Pre-formatted `file#^blockId` — see formatScheduledItemBlockTarget. */
    canonicalTarget: string;
    referenceBlockId: string;
}

export interface ParsedFocusSessionWeekReference {
    title: string;
    start: string;
    end: string;
    canonicalTarget: string;
    referenceBlockId: string;
}

// The bracket capture stops at `|` or `]` so an optional `|Label` alias never leaks into
// canonicalTarget — the dedup/removal key stays exactly `file#^blockId` regardless of alias.
const TIMED_RE =
    /^-\s+(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\s+-\s+(\d{2}:\d{2})\s+(.+?)\s+\|\s+canonical:\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/;

/**
 * Renders a derived, non-canonical Focus Session reference for a Weekly note. Mirrors
 * EventDayReference's daily reference shape, but the canonical link carries a `|Label` alias
 * (the owner's title) instead of a bare `[[file#^id]]` — so the note reads as a friendly link,
 * not raw wikilink syntax. Uses the `focus-ref-*` block-id namespace (reserved but unused until
 * now), never `focus-*`, so parsers can tell a reference apart from the canonical child line.
 */
export function formatFocusSessionWeekReferenceLine(fields: FocusSessionWeekReferenceFields): string {
    // Wikilink aliases can't contain `[`, `]`, or `|` — strip them defensively since the title
    // comes from user-authored Event/Task text, not something this module controls.
    const alias = fields.title.replace(/[[\]|]/g, "").trim() || "Focus session";
    return `- ${fmtDate(fields.start)} ${fmtTime(fields.start)} - ${fmtTime(fields.end)} ${fields.title} | canonical:[[${fields.canonicalTarget}|${alias}]] ^${fields.referenceBlockId}`;
}

export function parseFocusSessionWeekReferenceLine(line: string): ParsedFocusSessionWeekReference | null {
    const { semanticLine, blockId } = extractScheduledItemBlockId(line);
    if (!blockId || classifyScheduledItemBlockId(blockId) !== "focus-reference") return null;
    const match = semanticLine.trim().match(TIMED_RE);
    if (!match) return null;
    const [, start, end, title, canonicalTarget] = match;
    return { title, start, end, canonicalTarget, referenceBlockId: blockId };
}

function fmtDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function fmtTime(d: Date): string {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
