import { parseObjectReferences, serializeObjectReference } from "./ObjectReference.ts";

export type InboxRichTextPart =
    | { kind: "text"; value: string }
    | { kind: "link"; label: string; filePath: string; subpath?: string };

export function isInboxLineBreakInput(inputType: string): boolean {
    return inputType === "insertParagraph" || inputType === "insertLineBreak";
}

export function parseInboxRichText(
    markdown: string,
    resolveDestination: (destination: string) => string | null,
): InboxRichTextPart[] {
    const parts: InboxRichTextPart[] = [];
    const pattern = /\[((?:\\.|[^\]])+)\]\(([^)\n]+)\)/g;
    let cursor = 0;
    const pushText = (value: string): void => {
        if (!value) return;
        const previous = parts[parts.length - 1];
        if (previous?.kind === "text") previous.value += value;
        else parts.push({ kind: "text", value });
    };

    let match = pattern.exec(markdown);
    while (match !== null) {
        if (match.index > cursor) pushText(markdown.slice(cursor, match.index));
        const { destination, subpath } = splitBlockSubpath(match[2]);
        const filePath = resolveDestination(destination);
        if (filePath) {
            parts.push({
                kind: "link",
                label: match[1].replace(/\\([[\]\\])/g, "$1"),
                filePath,
                ...(subpath ? { subpath } : {}),
            });
        } else {
            pushText(match[0]);
        }
        cursor = pattern.lastIndex;
        match = pattern.exec(markdown);
    }

    if (cursor < markdown.length) pushText(markdown.slice(cursor));
    return parts;
}

export function serializeInboxRichText(
    parts: InboxRichTextPart[],
    targetFile: string,
    formatLink: (targetFile: string, filePath: string, label: string, subpath?: string) => string,
): string {
    return parts
        .map((part) =>
            part.kind === "text" ? part.value : formatLink(targetFile, part.filePath, part.label, part.subpath),
        )
        .join("");
}

export function parseObjectReferenceRichText(markdown: string): InboxRichTextPart[] {
    const parts: InboxRichTextPart[] = [];
    let cursor = 0;
    for (const occurrence of parseObjectReferences(markdown)) {
        if (!occurrence.reference.vaultPath) continue;
        if (occurrence.start > cursor) parts.push({ kind: "text", value: markdown.slice(cursor, occurrence.start) });
        parts.push({
            kind: "link",
            label: occurrence.reference.label,
            filePath: occurrence.reference.vaultPath,
        });
        cursor = occurrence.end;
    }
    if (cursor < markdown.length) parts.push({ kind: "text", value: markdown.slice(cursor) });
    return parts;
}

export function parseContextRichText(
    markdown: string,
    resolveDestination: (destination: string) => string | null,
): InboxRichTextPart[] {
    return parseInboxRichText(markdown, resolveDestination).flatMap((part) =>
        part.kind === "text" ? parseObjectReferenceRichText(part.value) : [part],
    );
}

export function formatObjectReferencePart(_targetFile: string, filePath: string, label: string): string {
    return serializeObjectReference({ label, vaultPath: filePath });
}

function splitBlockSubpath(destination: string): { destination: string; subpath: string | null } {
    const index = destination.indexOf("#^");
    return index === -1
        ? { destination, subpath: null }
        : { destination: destination.slice(0, index), subpath: destination.slice(index) };
}
