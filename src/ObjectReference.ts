export interface ObjectReference {
    label: string;
    vaultPath: string | null;
}

export interface ObjectReferenceOccurrence {
    reference: ObjectReference;
    raw: string;
    start: number;
    end: number;
}

const REFERENCE_RE = /(^|[\s([{"'])(@(?:\{([^{}\r\n]+)\}|([\p{L}\p{N}_-]+)))/gu;

export function parseObjectReferences(text: string): ObjectReferenceOccurrence[] {
    const occurrences: ObjectReferenceOccurrence[] = [];
    for (const match of text.matchAll(REFERENCE_RE)) {
        const raw = match[2];
        const pathInput = match[3];
        const unresolvedLabel = match[4];
        const prefixLength = match[1].length;
        const start = (match.index ?? 0) + prefixLength;
        if (pathInput !== undefined) {
            const vaultPath = normalizeObjectReferencePath(pathInput);
            if (!vaultPath) continue;
            occurrences.push({
                reference: { label: labelFromPath(vaultPath), vaultPath },
                raw,
                start,
                end: start + raw.length,
            });
            continue;
        }
        if (!unresolvedLabel) continue;
        occurrences.push({
            reference: { label: unresolvedLabel, vaultPath: null },
            raw,
            start,
            end: start + raw.length,
        });
    }
    return occurrences;
}

export function normalizeObjectReferencePath(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed || /^[\\/]/.test(trimmed)) return null;
    const normalized = trimmed.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
    const segments = normalized.split("/");
    if (segments.some((segment) => !segment || segment === "." || segment === "..")) return null;
    const withExtension = normalized.toLowerCase().endsWith(".md")
        ? `${normalized.slice(0, -3)}.md`
        : `${normalized}.md`;
    return withExtension.includes(":") ? null : withExtension;
}

export function serializeObjectReference(reference: ObjectReference): string {
    if (reference.vaultPath) {
        const path = normalizeObjectReferencePath(reference.vaultPath);
        if (path) return `@{${path}}`;
    }
    const label = reference.label
        .trim()
        .replace(/\s+/g, "_")
        .replace(/[^\p{L}\p{N}_-]/gu, "");
    return `@${label || "Object"}`;
}

function labelFromPath(vaultPath: string): string {
    const fileName = vaultPath.split("/").at(-1) ?? vaultPath;
    return fileName.replace(/\.md$/i, "");
}
