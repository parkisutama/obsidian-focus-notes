import {
    type LedgerRecordSnapshot,
    type ReplaceLedgerRecordResult,
    replaceLedgerRecordBlock,
} from "./LedgerRecordSource.ts";
import { formatTaskTimeboxLine, parseTaskTimeboxLine } from "./TaskTimeboxLine.ts";
import type { TaskTimebox } from "./TaskTimebox.ts";

export type ScheduledItemBlockDetail = { mode: "none" } | { mode: "link"; title: string; path: string };

export interface ScheduledItemBlock {
    firstLine: string;
    description: string;
    detailNote: ScheduledItemBlockDetail;
    timeboxes: TaskTimebox[];
    lineEnding: "\n" | "\r\n";
}

export interface ScheduledItemBlockEdit {
    firstLine: string;
    description: string;
    detailNote: ScheduledItemBlockDetail;
    timeboxes?: TaskTimebox[];
}

export type ParseScheduledItemBlockResult =
    | { status: "parsed"; block: ScheduledItemBlock }
    | {
          status: "invalid";
          reason: "empty-block" | "duplicate-detail" | "duplicate-timebox-id" | "invalid-timebox-line";
      };

interface OwnedChildren {
    descriptionIndexes: number[];
    detailIndexes: number[];
    timeboxIndexes: number[];
    description: string[];
    detailNote: ScheduledItemBlockDetail;
    timeboxes: TaskTimebox[];
    /**
     * Raw, verbatim lines nested under each timebox (its focus-session history and any notes),
     * keyed by timeboxId so an edit that reorders or changes a timebox's own fields still carries
     * its descendants along by identity rather than by file position.
     */
    timeboxDescendants: Map<string, string[]>;
    invalidTimeboxLine: boolean;
    indent: string;
}

export function parseScheduledItemBlock(rawBlock: string): ParseScheduledItemBlockResult {
    const lineEnding = rawBlock.includes("\r\n") ? "\r\n" : "\n";
    const lines = rawBlock.split(/\r?\n/);
    const firstLine = lines[0];
    if (!firstLine) return { status: "invalid", reason: "empty-block" };

    const owned = inspectOwnedChildren(lines);
    if (owned.detailIndexes.length > 1) return { status: "invalid", reason: "duplicate-detail" };
    if (owned.invalidTimeboxLine) return { status: "invalid", reason: "invalid-timebox-line" };
    if (new Set(owned.timeboxes.map((t) => t.timeboxId)).size !== owned.timeboxes.length) {
        return { status: "invalid", reason: "duplicate-timebox-id" };
    }
    return {
        status: "parsed",
        block: {
            firstLine,
            description: owned.description.join("\n"),
            detailNote: owned.detailNote,
            timeboxes: owned.timeboxes,
            lineEnding,
        },
    };
}

export function replaceScheduledItemBlock(
    content: string,
    snapshot: LedgerRecordSnapshot,
    edit: ScheduledItemBlockEdit,
): ReplaceLedgerRecordResult | Extract<ParseScheduledItemBlockResult, { status: "invalid" }> {
    const parsed = parseScheduledItemBlock(snapshot.rawBlock);
    if (parsed.status === "invalid") return parsed;
    if (sameSemanticBlock(parsed.block, edit)) {
        return replaceLedgerRecordBlock(content, snapshot, snapshot.rawBlock);
    }

    const lines = snapshot.rawBlock.split(/\r?\n/);
    const owned = inspectOwnedChildren(lines);
    // A caller that never sets edit.timeboxes doesn't know about timeboxes yet (they predate
    // Task 33's grammar) and must not silently wipe them; only an explicit array replaces them.
    const ownedIndexes = new Set([
        ...owned.descriptionIndexes,
        ...owned.detailIndexes,
        ...(edit.timeboxes !== undefined ? owned.timeboxIndexes : []),
    ]);
    const insertionIndex = Math.min(...ownedIndexes, 1);
    const replacementChildren = formatOwnedChildren(edit, owned.indent, owned.timeboxDescendants);
    const nextLines: string[] = [edit.firstLine];

    for (let index = 1; index < lines.length; index += 1) {
        if (index === insertionIndex) nextLines.push(...replacementChildren);
        if (!ownedIndexes.has(index)) nextLines.push(lines[index]);
    }
    if (lines.length === 1 || insertionIndex >= lines.length) nextLines.push(...replacementChildren);

    return replaceLedgerRecordBlock(content, snapshot, nextLines.join(parsed.block.lineEnding));
}

interface DescendantFrame {
    indentLength: number;
    excluded: boolean;
}

function inspectOwnedChildren(lines: string[]): OwnedChildren {
    const directIndent = findDirectIndent(lines.slice(1));
    const descriptionIndexes: number[] = [];
    const detailIndexes: number[] = [];
    const timeboxIndexes: number[] = [];
    const description: string[] = [];
    const timeboxes: TaskTimebox[] = [];
    const timeboxDescendants = new Map<string, string[]>();
    let detailNote: ScheduledItemBlockDetail = { mode: "none" };
    let invalidTimeboxLine = false;

    if (!directIndent) {
        return {
            descriptionIndexes,
            detailIndexes,
            timeboxIndexes,
            description,
            detailNote,
            timeboxes,
            timeboxDescendants,
            invalidTimeboxLine,
            indent: "    ",
        };
    }

    // Nested subtasks (checkboxes) and blockquotes are separate entities, not description
    // prose, so they (and anything nested under them) stay excluded from the description
    // and untouched on disk. Plain "- " bullets at any depth are description content and
    // stay connected to the outliner: deeper ones keep their residual indentation as part
    // of their text so multi-level nesting round-trips through the flat description field.
    const stack: DescendantFrame[] = [{ indentLength: -1, excluded: false }];
    // Tracks which timebox (if any) the current excluded subtree is nested under, so its
    // focus-session history and notes move with it by identity rather than by file position —
    // see the `timeboxDescendants` field this feeds.
    let activeTimeboxId: string | null = null;

    for (let index = 1; index < lines.length; index += 1) {
        const line = lines[index];
        if (!line.trim()) continue;
        const indentLength = line.match(/^[\t ]*/)?.[0].length ?? 0;
        if (indentLength < directIndent.length) continue;

        while (stack.length > 1 && stack[stack.length - 1].indentLength >= indentLength) stack.pop();
        const parent = stack[stack.length - 1];

        const bulletMatch = line.slice(indentLength).match(/^- (.*)$/);
        if (!bulletMatch || parent.excluded) {
            if (activeTimeboxId) {
                const descendants = timeboxDescendants.get(activeTimeboxId) ?? [];
                descendants.push(line);
                timeboxDescendants.set(activeTimeboxId, descendants);
                timeboxIndexes.push(index);
            }
            stack.push({ indentLength, excluded: true });
            continue;
        }
        const payload = bulletMatch[1];
        const isDirectChild = indentLength === directIndent.length;

        if (isDirectChild) {
            activeTimeboxId = null;
            const detail = parseDetail(payload);
            if (detail) {
                detailIndexes.push(index);
                detailNote = detail;
                stack.push({ indentLength, excluded: true });
                continue;
            }
            if (/^timebox\b/i.test(payload)) {
                const parsedTimebox = parseTaskTimeboxLine(line);
                if (parsedTimebox.status === "parsed") {
                    timeboxes.push(parsedTimebox.timebox);
                    activeTimeboxId = parsedTimebox.timebox.timeboxId;
                } else {
                    invalidTimeboxLine = true;
                }
                timeboxIndexes.push(index);
                stack.push({ indentLength, excluded: true });
                continue;
            }
            if (/^detail\s*:/i.test(payload) || /^\[(?: |x|X)\]\s/.test(payload)) {
                stack.push({ indentLength, excluded: true });
                continue;
            }
            descriptionIndexes.push(index);
            description.push(payload);
            stack.push({ indentLength, excluded: false });
            continue;
        }

        if (/^\[(?: |x|X)\]\s/.test(payload)) {
            stack.push({ indentLength, excluded: true });
            continue;
        }
        descriptionIndexes.push(index);
        description.push(line.slice(directIndent.length));
        stack.push({ indentLength, excluded: false });
    }

    return {
        descriptionIndexes,
        detailIndexes,
        timeboxIndexes,
        description,
        detailNote,
        timeboxes,
        timeboxDescendants,
        invalidTimeboxLine,
        indent: directIndent,
    };
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

function formatOwnedChildren(
    edit: ScheduledItemBlockEdit,
    indent: string,
    timeboxDescendants: Map<string, string[]>,
): string[] {
    // A line with leading whitespace was captured from a deeper nesting level (see
    // inspectOwnedChildren); re-indent it under the base indent instead of flattening it
    // to a top-level bullet, so multi-level outliner structure survives the round trip.
    const result = edit.description
        .split(/\r?\n/)
        .map((line) => line.replace(/[\t ]+$/, ""))
        .filter((line) => line.trim().length > 0)
        .map((line) => (/^[\t ]/.test(line) ? `${indent}${line}` : `${indent}- ${line}`));
    if (edit.detailNote.mode === "link") {
        result.push(`${indent}- detail: [${edit.detailNote.title}](${edit.detailNote.path.replace(/ /g, "%20")})`);
    }
    for (const timebox of edit.timeboxes ?? []) {
        result.push(formatTaskTimeboxLine(timebox, indent));
        // Reattached by timeboxId, not file position, so its Focus Session history and notes
        // move with it through edits/reorders and disappear cleanly if the timebox is deleted.
        for (const descendant of timeboxDescendants.get(timebox.timeboxId) ?? []) result.push(descendant);
    }
    return result;
}

function sameSemanticBlock(block: ScheduledItemBlock, edit: ScheduledItemBlockEdit): boolean {
    const timeboxesUnchanged =
        edit.timeboxes === undefined || JSON.stringify(block.timeboxes) === JSON.stringify(edit.timeboxes);
    return (
        block.firstLine === edit.firstLine &&
        block.description === edit.description &&
        JSON.stringify(block.detailNote) === JSON.stringify(edit.detailNote) &&
        timeboxesUnchanged
    );
}
