import {
    replaceLedgerRecordBlock,
    type LedgerRecordSnapshot,
    type ReplaceLedgerRecordResult,
} from "./LedgerRecordSource.ts";

export type ScheduledItemBlockDetail = { mode: "none" } | { mode: "link"; title: string; path: string };

export interface ScheduledItemBlock {
    firstLine: string;
    description: string;
    detailNote: ScheduledItemBlockDetail;
    lineEnding: "\n" | "\r\n";
}

export interface ScheduledItemBlockEdit {
    firstLine: string;
    description: string;
    detailNote: ScheduledItemBlockDetail;
}

export type ParseScheduledItemBlockResult =
    | { status: "parsed"; block: ScheduledItemBlock }
    | { status: "invalid"; reason: "empty-block" | "duplicate-detail" };

interface OwnedChildren {
    descriptionIndexes: number[];
    detailIndexes: number[];
    description: string[];
    detailNote: ScheduledItemBlockDetail;
    indent: string;
}

export function parseScheduledItemBlock(rawBlock: string): ParseScheduledItemBlockResult {
    const lineEnding = rawBlock.includes("\r\n") ? "\r\n" : "\n";
    const lines = rawBlock.split(/\r?\n/);
    const firstLine = lines[0];
    if (!firstLine) return { status: "invalid", reason: "empty-block" };

    const owned = inspectOwnedChildren(lines);
    if (owned.detailIndexes.length > 1) return { status: "invalid", reason: "duplicate-detail" };
    return {
        status: "parsed",
        block: {
            firstLine,
            description: owned.description.join("\n"),
            detailNote: owned.detailNote,
            lineEnding,
        },
    };
}

export function replaceScheduledItemBlock(
    content: string,
    snapshot: LedgerRecordSnapshot,
    edit: ScheduledItemBlockEdit,
): ReplaceLedgerRecordResult | { status: "invalid"; reason: "empty-block" | "duplicate-detail" } {
    const parsed = parseScheduledItemBlock(snapshot.rawBlock);
    if (parsed.status === "invalid") return parsed;
    if (sameSemanticBlock(parsed.block, edit)) {
        return replaceLedgerRecordBlock(content, snapshot, snapshot.rawBlock);
    }

    const lines = snapshot.rawBlock.split(/\r?\n/);
    const owned = inspectOwnedChildren(lines);
    const ownedIndexes = new Set([...owned.descriptionIndexes, ...owned.detailIndexes]);
    const insertionIndex = Math.min(...ownedIndexes, 1);
    const replacementChildren = formatOwnedChildren(edit, owned.indent);
    const nextLines: string[] = [edit.firstLine];

    for (let index = 1; index < lines.length; index += 1) {
        if (index === insertionIndex) nextLines.push(...replacementChildren);
        if (!ownedIndexes.has(index)) nextLines.push(lines[index]);
    }
    if (lines.length === 1 || insertionIndex >= lines.length) nextLines.push(...replacementChildren);

    return replaceLedgerRecordBlock(content, snapshot, nextLines.join(parsed.block.lineEnding));
}

function inspectOwnedChildren(lines: string[]): OwnedChildren {
    const directIndent = findDirectIndent(lines.slice(1));
    const descriptionIndexes: number[] = [];
    const detailIndexes: number[] = [];
    const description: string[] = [];
    let detailNote: ScheduledItemBlockDetail = { mode: "none" };

    if (!directIndent) {
        return { descriptionIndexes, detailIndexes, description, detailNote, indent: "    " };
    }

    for (let index = 1; index < lines.length; index += 1) {
        const line = lines[index];
        if (!line.startsWith(`${directIndent}- `)) continue;
        const payload = line.slice(directIndent.length + 2);
        const detail = parseDetail(payload);
        if (detail) {
            detailIndexes.push(index);
            detailNote = detail;
            continue;
        }
        if (/^detail\s*:/i.test(payload) || /^\[(?: |x|X)\]\s/.test(payload)) continue;
        descriptionIndexes.push(index);
        description.push(payload);
    }

    return { descriptionIndexes, detailIndexes, description, detailNote, indent: directIndent };
}

function findDirectIndent(lines: string[]): string | null {
    let result: string | null = null;
    for (const line of lines) {
        if (!line.trim()) continue;
        const indent = line.match(/^[\t ]+/)?.[0];
        if (!indent) continue;
        if (result === null || indent.length < result.length) result = indent;
    }
    return result;
}

function parseDetail(payload: string): ScheduledItemBlockDetail | null {
    const match = payload.match(/^detail:\s*\[([^\]]+)\]\(([^)]+)\)\s*$/i);
    if (!match) return null;
    return { mode: "link", title: match[1], path: decodePath(match[2]) };
}

function decodePath(path: string): string {
    try {
        return decodeURIComponent(path);
    } catch {
        return path;
    }
}

function formatOwnedChildren(edit: ScheduledItemBlockEdit, indent: string): string[] {
    const result = edit.description
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => `${indent}- ${line}`);
    if (edit.detailNote.mode === "link") {
        result.push(`${indent}- detail: [${edit.detailNote.title}](${edit.detailNote.path.replace(/ /g, "%20")})`);
    }
    return result;
}

function sameSemanticBlock(block: ScheduledItemBlock, edit: ScheduledItemBlockEdit): boolean {
    return (
        block.firstLine === edit.firstLine &&
        block.description === edit.description &&
        JSON.stringify(block.detailNote) === JSON.stringify(edit.detailNote)
    );
}
