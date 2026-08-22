import { parseTaskLineEdit, type TaskLineInvalidReason } from "./TaskLineEditor.ts";
import { appendScheduledItemBlockId, extractScheduledItemBlockId } from "./ScheduledItemBlockId.ts";

export type TaskLineLintStatus = "plain" | "valid" | "needs-format" | "warning";

export interface TaskLineInspection {
    status: TaskLineLintStatus;
    normalizedLine: string | null;
    reason: TaskLineInvalidReason | null;
}

export function taskLineLintLabel(status: TaskLineLintStatus): string {
    if (status === "needs-format") return "Needs format";
    return status.charAt(0).toUpperCase() + status.slice(1);
}

const OWNED_KEY_ORDER = new Map([
    ["priority", 0],
    ["due", 1],
    ["start", 2],
    ["end", 3],
    ["remind", 4],
]);

export function inspectTaskLine(line: string): TaskLineInspection {
    const parsed = parseTaskLineEdit(line);
    if (parsed.status === "invalid") return { status: "warning", normalizedLine: null, reason: parsed.reason };

    const { semanticLine, blockId } = extractScheduledItemBlockId(line);
    const match = semanticLine.match(/^(\s*-\s+\[(?: |x|X)\]\s+)(.+)$/);
    if (!match) return { status: "warning", normalizedLine: null, reason: "not-task" };
    const segments = match[2].split(" | ");
    const title = segments.shift() ?? "";
    const ownedPositions: number[] = [];
    const ownedSegments: Array<{ segment: string; rank: number; sourceIndex: number }> = [];

    for (const [index, segment] of segments.entries()) {
        const key = metadataKey(segment);
        const rank = key ? OWNED_KEY_ORDER.get(key) : undefined;
        if (rank === undefined) continue;
        ownedPositions.push(index);
        ownedSegments.push({ segment, rank, sourceIndex: index });
    }
    if (ownedSegments.length === 0) return { status: "plain", normalizedLine: line, reason: null };

    ownedSegments.sort((a, b) => a.rank - b.rank || a.sourceIndex - b.sourceIndex);
    const normalizedSegments = [...segments];
    for (const [index, position] of ownedPositions.entries()) {
        normalizedSegments[position] = ownedSegments[index].segment;
    }
    const semanticNormalizedLine = `${match[1]}${[title, ...normalizedSegments].join(" | ")}`;
    const normalizedLine = blockId
        ? appendScheduledItemBlockId(semanticNormalizedLine, blockId)
        : semanticNormalizedLine;
    return {
        status: normalizedLine === line ? "valid" : "needs-format",
        normalizedLine,
        reason: null,
    };
}

function metadataKey(segment: string): string | null {
    const separator = segment.indexOf(":");
    return separator === -1 ? null : segment.slice(0, separator).trim().toLowerCase();
}
