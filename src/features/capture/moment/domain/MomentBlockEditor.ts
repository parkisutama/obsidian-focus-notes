import type { ReflectionBlockFields } from "../../../reflection/domain/ReflectionBlockLine.ts";
import { formatReflectionLabelLine, reflectionFieldsPresent } from "../../../reflection/domain/ReflectionBlockLine.ts";
import { formatDescriptionLine, formatReflectionNotesLine } from "../../shared/domain/FlatBlockChildLine.ts";
import type {
    LedgerRecordSnapshot,
    ReplaceLedgerRecordResult,
} from "../../scheduled-item/domain/LedgerRecordSource.ts";
import { replaceLedgerRecordBlock } from "../../scheduled-item/domain/LedgerRecordSource.ts";
import { parseMomentBlock, type MomentBlockInvalidReason } from "./MomentBlock.ts";

export interface MomentBlockEdit {
    description: string;
    reflection: ReflectionBlockFields;
    reflectionNotes: string | null;
}

export type ReplaceMomentBlockResult =
    | ReplaceLedgerRecordResult
    | { status: "invalid"; reason: MomentBlockInvalidReason };

const KNOWN_CHILD = /^ {4}- (?:description|reflection|reflection-notes):/i;

/** Rewrites only Moment-owned children, preserving identity, heading and unknown nested Markdown. */
export function replaceMomentBlock(
    content: string,
    snapshot: LedgerRecordSnapshot,
    edit: MomentBlockEdit,
): ReplaceMomentBlockResult {
    const parsed = parseMomentBlock(snapshot.rawBlock);
    if (parsed.status === "invalid") return parsed;
    if (
        parsed.block.description === edit.description.trim() &&
        sameReflection(parsed.block.reflection, edit.reflection) &&
        (parsed.block.reflectionNotes ?? "") === (edit.reflectionNotes?.trim() ?? "")
    ) {
        return replaceLedgerRecordBlock(content, snapshot, snapshot.rawBlock);
    }

    const lines = snapshot.rawBlock.split(/\r?\n/);
    const canonical = [formatDescriptionLine("    ", edit.description)];
    if (reflectionFieldsPresent(edit.reflection)) canonical.push(formatReflectionLabelLine("    ", edit.reflection));
    canonical.push(formatReflectionNotesLine("    ", edit.reflectionNotes ?? ""));
    const unknown = lines.slice(1).filter((line) => !KNOWN_CHILD.test(line));
    const newBlock = [lines[0] ?? "", ...canonical.filter((line): line is string => line !== null), ...unknown].join(
        detectLineEnding(snapshot.rawBlock),
    );
    return replaceLedgerRecordBlock(content, snapshot, newBlock);
}

function sameReflection(left: ReflectionBlockFields, right: ReflectionBlockFields): boolean {
    return (
        left.stressLevel === right.stressLevel &&
        left.emotionCategory === right.emotionCategory &&
        left.emotionKey === right.emotionKey
    );
}

function detectLineEnding(value: string): string {
    return value.includes("\r\n") ? "\r\n" : "\n";
}
