import { parseTaskDayReferenceLine } from "./TaskDayReference.ts";

export interface TaskReferenceCheckboxToggle {
    canonicalTarget: string;
    completed: boolean;
}

/**
 * Diffs a file's previous and next content and reports every Task reference whose checkbox
 * actually flipped. A reference line that is new (no previous match by referenceBlockId) is not
 * reported — only an observed transition counts as a user completion command, so a freshly
 * written reference (which already bakes in the current completed state) never re-triggers itself.
 */
export function detectTaskReferenceCheckboxToggles(
    previousContent: string | undefined,
    nextContent: string,
): TaskReferenceCheckboxToggle[] {
    if (previousContent === undefined || previousContent === nextContent) return [];
    const previousByBlockId = indexByReferenceBlockId(previousContent);
    const toggles: TaskReferenceCheckboxToggle[] = [];
    for (const [blockId, next] of indexByReferenceBlockId(nextContent)) {
        const previous = previousByBlockId.get(blockId);
        if (previous && previous.completed !== next.completed) {
            toggles.push({ canonicalTarget: next.canonicalTarget, completed: next.completed });
        }
    }
    return toggles;
}

function indexByReferenceBlockId(content: string): Map<string, { completed: boolean; canonicalTarget: string }> {
    const map = new Map<string, { completed: boolean; canonicalTarget: string }>();
    for (const line of content.split(/\r?\n/)) {
        const ref = parseTaskDayReferenceLine(line);
        if (ref) map.set(ref.referenceBlockId, { completed: ref.completed, canonicalTarget: ref.canonicalTarget });
    }
    return map;
}
