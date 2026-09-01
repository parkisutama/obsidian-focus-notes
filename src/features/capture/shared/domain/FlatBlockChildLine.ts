const DESCRIPTION_RE = /^description:\s?(.*)$/i;
const REFLECTION_NOTES_RE = /^reflection-notes:\s?(.*)$/i;

/** Canonical free-text child values occupy one physical Markdown line. */
export function normalizeFlatBlockText(value: string): string {
    return value.replace(/\s+/g, " ").trim();
}

export function parseDescriptionLine(payload: string): string | null {
    const match = payload.match(DESCRIPTION_RE);
    return match ? match[1].trim() : null;
}

export function formatDescriptionLine(indent: string, value: string): string | null {
    const normalized = normalizeFlatBlockText(value);
    return normalized ? `${indent}- description: ${normalized}` : null;
}

export function parseReflectionNotesLine(payload: string): string | null {
    const match = payload.match(REFLECTION_NOTES_RE);
    return match ? match[1].trim() : null;
}

export function formatReflectionNotesLine(indent: string, value: string): string | null {
    const normalized = normalizeFlatBlockText(value);
    return normalized ? `${indent}- reflection-notes: ${normalized}` : null;
}
