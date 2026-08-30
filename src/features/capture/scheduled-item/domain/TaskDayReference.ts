import {
    classifyScheduledItemBlockId,
    extractScheduledItemBlockId,
    formatScheduledItemBlockTarget,
} from "./ScheduledItemBlockId.ts";
import { removeMarkdownLineWithBlockId } from "./ScheduledItemLineRemoval.ts";

export interface TaskDayReferenceFields {
    title: string;
    completed: boolean;
    due: boolean;
    timeboxId: string | null;
    canonicalFilePath: string;
    canonicalBlockId: string;
    referenceBlockId: string;
}

export interface ParsedTaskDayReference {
    title: string;
    completed: boolean;
    due: boolean;
    timeboxId: string | null;
    canonicalTarget: string;
    referenceBlockId: string;
}

const TASK_REF_RE =
    /^-\s+\[( |x|X)\]\s+(.+?)\s+\|\s+canonical:\[\[(.+?)\]\](?:\s+\|\s+due:true)?(?:\s+\|\s+timebox:(\S+))?$/;

/**
 * Renders a derived, non-canonical Task day reference. Keeps checkbox syntax (per the spec's
 * rule that Task references stay visually recognizable as Tasks) but carries a `task-ref-*`
 * block id — never `task-*` — plus a `canonical:` link back to the source block, mirroring
 * EventDayReference's classify-by-namespace approach.
 */
export function formatTaskDayReferenceLine(fields: TaskDayReferenceFields): string {
    const target = formatScheduledItemBlockTarget(fields.canonicalFilePath, fields.canonicalBlockId);
    const checkbox = fields.completed ? "x" : " ";
    const segments = [`- [${checkbox}] ${fields.title} | canonical:[[${target}]]`];
    if (fields.due) segments.push("due:true");
    if (fields.timeboxId) segments.push(`timebox:${fields.timeboxId}`);
    return `${segments.join(" | ")} ^${fields.referenceBlockId}`;
}

export function parseTaskDayReferenceLine(line: string): ParsedTaskDayReference | null {
    const { semanticLine, blockId } = extractScheduledItemBlockId(line);
    if (!blockId || classifyScheduledItemBlockId(blockId) !== "task-reference") return null;
    const match = semanticLine.trim().match(TASK_REF_RE);
    if (!match) return null;
    const [, checkbox, title, canonicalTarget, timeboxId] = match;
    return {
        title,
        completed: checkbox.toLowerCase() === "x",
        due: /\|\s*due:true(?:\s|$)/.test(semanticLine),
        timeboxId: timeboxId ?? null,
        canonicalTarget,
        referenceBlockId: blockId,
    };
}

/** Self-describing removal, mirroring removeEventDayReferenceForCanonical: no external day→blockId map needed. */
export function removeTaskDayReference(content: string, canonicalTarget: string, timeboxId: string | null): string {
    const lines = content.split(/(?<=\n)/);
    for (const line of lines) {
        const parsed = parseTaskDayReferenceLine(line.replace(/\n$/, ""));
        if (parsed && parsed.canonicalTarget === canonicalTarget && parsed.timeboxId === timeboxId) {
            return removeMarkdownLineWithBlockId(content, parsed.referenceBlockId);
        }
    }
    return content;
}
