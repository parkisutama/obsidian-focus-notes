import { parseFocusSessionLine } from "../../../focus-session/domain/FocusSessionLine.ts";
import {
    formatReflectionLabelLine,
    parseReflectionLabel,
    type ReflectionBlockFields,
} from "../../../reflection/domain/ReflectionBlockLine.ts";
import {
    formatDescriptionLine,
    formatReflectionNotesLine,
    parseDescriptionLine,
    parseReflectionNotesLine,
} from "../../shared/domain/FlatBlockChildLine.ts";
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
    reflection: ReflectionBlockFields;
    reflectionNotes: string | null;
    timeboxes: TaskTimebox[];
    lineEnding: "\n" | "\r\n";
}

export interface ScheduledItemBlockEdit {
    firstLine: string;
    description: string;
    detailNote: ScheduledItemBlockDetail;
    /** Omit to preserve the current owner Reflection line. */
    reflection?: ReflectionBlockFields;
    /** Omit to preserve the current Reflection Notes line; null/empty removes it. */
    reflectionNotes?: string | null;
    /** Omit to preserve the current Timebox list. */
    timeboxes?: TaskTimebox[];
}

export type ParseScheduledItemBlockResult =
    | { status: "parsed"; block: ScheduledItemBlock }
    | {
          status: "invalid";
          reason:
              | "empty-block"
              | "duplicate-description"
              | "duplicate-detail"
              | "duplicate-reflection"
              | "duplicate-reflection-notes"
              | "duplicate-timebox-id"
              | "duplicate-focus-session-id"
              | "invalid-timebox-line"
              | "invalid-focus-session-line";
      };

interface OwnedChildren {
    ownedIndexes: number[];
    descriptionIndexes: number[];
    detailIndexes: number[];
    reflectionIndexes: number[];
    reflectionNotesIndexes: number[];
    timeboxIndexes: number[];
    focusSessionIndexes: number[];
    description: string;
    detailNote: ScheduledItemBlockDetail;
    reflection: ReflectionBlockFields;
    reflectionNotes: string | null;
    timeboxes: TaskTimebox[];
    timeboxDescendants: Map<string, string[]>;
    focusSessionBlocks: string[][];
    focusSessionIds: string[];
    invalidTimeboxLine: boolean;
    invalidFocusSessionLine: boolean;
    indent: string;
}

const EMPTY_REFLECTION: ReflectionBlockFields = {
    stressLevel: null,
    emotionCategory: null,
    emotionKey: null,
};

export function parseScheduledItemBlock(rawBlock: string): ParseScheduledItemBlockResult {
    const lineEnding = rawBlock.includes("\r\n") ? "\r\n" : "\n";
    const lines = rawBlock.split(/\r?\n/);
    const firstLine = lines[0];
    if (!firstLine) return { status: "invalid", reason: "empty-block" };

    const owned = inspectOwnedChildren(lines);
    if (owned.descriptionIndexes.length > 1) return { status: "invalid", reason: "duplicate-description" };
    if (owned.detailIndexes.length > 1) return { status: "invalid", reason: "duplicate-detail" };
    if (owned.reflectionIndexes.length > 1) return { status: "invalid", reason: "duplicate-reflection" };
    if (owned.reflectionNotesIndexes.length > 1) {
        return { status: "invalid", reason: "duplicate-reflection-notes" };
    }
    if (owned.invalidTimeboxLine) return { status: "invalid", reason: "invalid-timebox-line" };
    if (owned.invalidFocusSessionLine) return { status: "invalid", reason: "invalid-focus-session-line" };
    if (new Set(owned.timeboxes.map((value) => value.timeboxId)).size !== owned.timeboxes.length) {
        return { status: "invalid", reason: "duplicate-timebox-id" };
    }
    if (new Set(owned.focusSessionIds).size !== owned.focusSessionIds.length) {
        return { status: "invalid", reason: "duplicate-focus-session-id" };
    }

    return {
        status: "parsed",
        block: {
            firstLine,
            description: owned.description,
            detailNote: owned.detailNote,
            reflection: owned.reflection,
            reflectionNotes: owned.reflectionNotes,
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
    const nextLines = reassembleBlock(lines, owned, edit, edit.firstLine);

    return replaceLedgerRecordBlock(content, snapshot, nextLines.join(parsed.block.lineEnding));
}

/**
 * Re-serializes a block into canonical child order, converting any historical shapes
 * `inspectOwnedChildren` tolerantly reads (the old `notes:` Reflection Notes prefix, a Task
 * Focus Session nested under its Timebox instead of as a direct sibling) into their approved
 * form. Returns null for an invalid block; returns the input unchanged (same string) when it's
 * already canonical, so a second pass is always a safe no-op.
 */
export function canonicalizeScheduledItemBlock(rawBlock: string): string | null {
    const parsed = parseScheduledItemBlock(rawBlock);
    if (parsed.status === "invalid") return null;
    const lines = rawBlock.split(/\r?\n/);
    const owned = inspectOwnedChildren(lines);
    const nextLines = reassembleBlock(lines, owned, {
        firstLine: parsed.block.firstLine,
        description: parsed.block.description,
        detailNote: parsed.block.detailNote,
        reflection: parsed.block.reflection,
        reflectionNotes: parsed.block.reflectionNotes,
        timeboxes: parsed.block.timeboxes,
    });
    return nextLines.join(parsed.block.lineEnding);
}

function reassembleBlock(
    lines: string[],
    owned: OwnedChildren,
    edit: ScheduledItemBlockEdit,
    firstLine: string = edit.firstLine,
): string[] {
    const ownedIndexes = new Set(owned.ownedIndexes);
    const insertionIndex = Math.min(...ownedIndexes, 1);
    const replacementChildren = formatOwnedChildren(edit, owned);
    const nextLines: string[] = [firstLine];

    for (let index = 1; index < lines.length; index += 1) {
        if (index === insertionIndex) nextLines.push(...replacementChildren);
        if (!ownedIndexes.has(index)) nextLines.push(lines[index]);
    }
    if (lines.length === 1 || insertionIndex >= lines.length) nextLines.push(...replacementChildren);

    return nextLines;
}

function inspectOwnedChildren(lines: string[]): OwnedChildren {
    const directIndent = findDirectIndent(lines.slice(1)) ?? "    ";
    const result: OwnedChildren = {
        ownedIndexes: [],
        descriptionIndexes: [],
        detailIndexes: [],
        reflectionIndexes: [],
        reflectionNotesIndexes: [],
        timeboxIndexes: [],
        focusSessionIndexes: [],
        description: "",
        detailNote: { mode: "none" },
        reflection: { ...EMPTY_REFLECTION },
        reflectionNotes: null,
        timeboxes: [],
        timeboxDescendants: new Map(),
        focusSessionBlocks: [],
        focusSessionIds: [],
        invalidTimeboxLine: false,
        invalidFocusSessionLine: false,
        indent: directIndent,
    };

    for (let index = 1; index < lines.length; index += 1) {
        const line = lines[index];
        if (!line.trim()) continue;
        const indentLength = leadingIndent(line);
        if (indentLength !== directIndent.length) continue;
        const payload = directChildPayload(line);
        if (payload === null) continue;

        const description = parseDescriptionLine(payload);
        if (description !== null) {
            result.descriptionIndexes.push(index);
            result.ownedIndexes.push(index);
            result.description = description;
            continue;
        }

        const detail = parseDetail(payload);
        if (detail) {
            result.detailIndexes.push(index);
            result.ownedIndexes.push(index);
            result.detailNote = detail;
            continue;
        }

        if (/^timebox\b/i.test(payload)) {
            const parsed = parseTaskTimeboxLine(line);
            if (parsed.status === "parsed") {
                result.timeboxes.push(parsed.timebox);
                const subtree = captureSubtree(lines, index, indentLength);
                const childIndentLength = indentLength + result.indent.length;
                const descendants: string[] = [];
                let cursor = 1;
                while (cursor < subtree.length) {
                    const entry = subtree[cursor];
                    const entryPayload = directChildPayload(entry.line);
                    const isNestedFocusSession =
                        leadingIndent(entry.line) === childIndentLength &&
                        entryPayload !== null &&
                        /^focus-session\b/i.test(entryPayload);
                    if (isNestedFocusSession) {
                        const nestedFocusSession = parseFocusSessionLine(entry.line);
                        if (nestedFocusSession.status === "parsed") {
                            let end = cursor;
                            while (
                                end + 1 < subtree.length &&
                                leadingIndent(subtree[end + 1].line) > childIndentLength
                            ) {
                                end += 1;
                            }
                            result.focusSessionIds.push(nestedFocusSession.session.sessionId);
                            result.focusSessionBlocks.push(
                                subtree.slice(cursor, end + 1).map((nested) => reindent(nested.line, indentLength)),
                            );
                            cursor = end + 1;
                            continue;
                        }
                    }
                    descendants.push(entry.line);
                    cursor += 1;
                }
                result.timeboxDescendants.set(parsed.timebox.timeboxId, descendants);
                for (const entry of subtree) {
                    result.timeboxIndexes.push(entry.index);
                    result.ownedIndexes.push(entry.index);
                }
                index = subtree[subtree.length - 1].index;
            } else {
                result.invalidTimeboxLine = true;
                result.timeboxIndexes.push(index);
                result.ownedIndexes.push(index);
            }
            continue;
        }

        if (/^focus-session\b/i.test(payload)) {
            const parsed = parseFocusSessionLine(line);
            if (parsed.status === "parsed") {
                result.focusSessionIds.push(parsed.session.sessionId);
                const subtree = captureSubtree(lines, index, indentLength);
                result.focusSessionBlocks.push(subtree.map((entry) => entry.line));
                for (const entry of subtree) {
                    result.focusSessionIndexes.push(entry.index);
                    result.ownedIndexes.push(entry.index);
                }
                index = subtree[subtree.length - 1].index;
            } else {
                result.invalidFocusSessionLine = true;
                result.focusSessionIndexes.push(index);
                result.ownedIndexes.push(index);
            }
            continue;
        }

        const reflection = parseReflectionLabel(payload);
        if (reflection) {
            result.reflectionIndexes.push(index);
            result.ownedIndexes.push(index);
            result.reflection = reflection;
            continue;
        }

        const reflectionNotes = parseReflectionNotesLine(payload);
        if (reflectionNotes !== null) {
            result.reflectionNotesIndexes.push(index);
            result.ownedIndexes.push(index);
            result.reflectionNotes = reflectionNotes;
            continue;
        }

        // Temporary read support for the uncommitted Task Reflection WIP. Task 60's explicit
        // formatter removes this shape; canonical writers never emit it.
        const oldNotes = payload.match(/^notes:\s?(.*)$/i);
        if (oldNotes) {
            result.reflectionNotesIndexes.push(index);
            result.ownedIndexes.push(index);
            result.reflectionNotes = oldNotes[1].trim();
            continue;
        }

        // Temporary read support for pre-approved plain description bullets. Canonical writers
        // immediately replace an edited value with `description:`.
        if (!/^\[(?: |x|X)\]\s/.test(payload) && !payload.includes(":")) {
            result.descriptionIndexes.push(index);
            result.ownedIndexes.push(index);
            result.description = payload;
        }
    }

    return result;
}

interface IndexedLine {
    index: number;
    line: string;
}

function captureSubtree(lines: string[], start: number, parentIndent: number): IndexedLine[] {
    const result: IndexedLine[] = [{ index: start, line: lines[start] }];
    for (let index = start + 1; index < lines.length; index += 1) {
        const line = lines[index];
        if (!line.trim() || leadingIndent(line) > parentIndent) {
            result.push({ index, line });
            continue;
        }
        break;
    }
    return result;
}

function formatOwnedChildren(edit: ScheduledItemBlockEdit, current: OwnedChildren): string[] {
    const result: string[] = [];
    const description = formatDescriptionLine(current.indent, edit.description);
    if (description) result.push(description);

    for (const timebox of edit.timeboxes ?? current.timeboxes) {
        result.push(formatTaskTimeboxLine(timebox, current.indent));
        for (const descendant of current.timeboxDescendants.get(timebox.timeboxId) ?? []) result.push(descendant);
    }

    for (const focusSessionBlock of current.focusSessionBlocks) result.push(...focusSessionBlock);

    const reflection = edit.reflection ?? current.reflection;
    if (reflectionPresent(reflection)) result.push(formatReflectionLabelLine(current.indent, reflection));

    const reflectionNotes = formatReflectionNotesLine(
        current.indent,
        edit.reflectionNotes === undefined ? (current.reflectionNotes ?? "") : (edit.reflectionNotes ?? ""),
    );
    if (reflectionNotes) result.push(reflectionNotes);

    if (edit.detailNote.mode === "link") {
        result.push(
            `${current.indent}- detail: [${edit.detailNote.title}](${edit.detailNote.path.replace(/ /g, "%20")})`,
        );
    }
    return result;
}

function sameSemanticBlock(block: ScheduledItemBlock, edit: ScheduledItemBlockEdit): boolean {
    const timeboxesUnchanged =
        edit.timeboxes === undefined || JSON.stringify(block.timeboxes) === JSON.stringify(edit.timeboxes);
    const reflectionUnchanged =
        edit.reflection === undefined || JSON.stringify(block.reflection) === JSON.stringify(edit.reflection);
    const reflectionNotesUnchanged =
        edit.reflectionNotes === undefined || (block.reflectionNotes ?? null) === (edit.reflectionNotes ?? null);
    return (
        block.firstLine === edit.firstLine &&
        block.description === edit.description &&
        JSON.stringify(block.detailNote) === JSON.stringify(edit.detailNote) &&
        reflectionUnchanged &&
        reflectionNotesUnchanged &&
        timeboxesUnchanged
    );
}

function reflectionPresent(fields: ReflectionBlockFields): boolean {
    return fields.stressLevel !== null || fields.emotionCategory !== null || fields.emotionKey !== null;
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

function leadingIndent(line: string): number {
    return line.match(/^[\t ]*/)?.[0].length ?? 0;
}

/** Shifts a line's leading indentation left by `removeChars`, used to promote a nested Focus Session to a top-level sibling. */
function reindent(line: string, removeChars: number): string {
    let index = 0;
    while (index < removeChars && index < line.length && (line[index] === " " || line[index] === "\t")) index += 1;
    return line.slice(index);
}

function directChildPayload(line: string): string | null {
    return line.trimStart().match(/^- (.*)$/)?.[1] ?? null;
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
