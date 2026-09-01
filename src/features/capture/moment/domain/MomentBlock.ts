import { parseDescriptionLine, parseReflectionNotesLine } from "../../shared/domain/FlatBlockChildLine.ts";
import { parseReflectionLabel, type ReflectionBlockFields } from "../../../reflection/domain/ReflectionBlockLine.ts";
import {
    classifyScheduledItemBlockId,
    extractScheduledItemBlockId,
} from "../../scheduled-item/domain/ScheduledItemBlockId.ts";

export interface MomentBlock {
    momentId: string;
    heading: string;
    description: string;
    reflection: ReflectionBlockFields;
    reflectionNotes: string | null;
}

export type MomentBlockInvalidReason =
    | "missing-id"
    | "duplicate-description"
    | "duplicate-reflection"
    | "duplicate-reflection-notes";

export type ParseMomentBlockResult =
    | { status: "parsed"; block: MomentBlock }
    | { status: "invalid"; reason: MomentBlockInvalidReason };

export function parseMomentBlock(rawBlock: string): ParseMomentBlockResult {
    const lines = rawBlock.split(/\r?\n/);
    const identity = extractScheduledItemBlockId(lines[0] ?? "");
    if (!identity.blockId || classifyScheduledItemBlockId(identity.blockId) !== "moment")
        return { status: "invalid", reason: "missing-id" };
    const descriptions: string[] = [];
    const reflections: ReflectionBlockFields[] = [];
    const notes: string[] = [];
    for (const line of lines.slice(1)) {
        if (!/^ {4}- /.test(line)) continue;
        const payload = line.slice(6);
        const description = parseDescriptionLine(payload);
        if (description !== null) descriptions.push(description);
        const reflection = parseReflectionLabel(payload);
        if (reflection) reflections.push(reflection);
        const reflectionNotes = parseReflectionNotesLine(payload);
        if (reflectionNotes !== null) notes.push(reflectionNotes);
    }
    if (descriptions.length > 1) return { status: "invalid", reason: "duplicate-description" };
    if (reflections.length > 1) return { status: "invalid", reason: "duplicate-reflection" };
    if (notes.length > 1) return { status: "invalid", reason: "duplicate-reflection-notes" };
    return {
        status: "parsed",
        block: {
            momentId: identity.blockId,
            heading: identity.semanticLine.replace(/^-\s*/, ""),
            description: descriptions[0] ?? "",
            reflection: reflections[0] ?? { stressLevel: null, emotionCategory: null, emotionKey: null },
            reflectionNotes: notes[0] ?? null,
        },
    };
}
