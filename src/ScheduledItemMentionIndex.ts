import type { ScheduledItemKind } from "./ScheduledItemTypes.ts";
import type { SuggestionMatcher } from "./InboxSuggestions.ts";

export interface ScheduledItemMentionRecord {
    blockId: string;
    kind: ScheduledItemKind;
    title: string;
    completed: boolean;
    status: "open" | "completed" | "planned" | "cancelled";
    lineNumber: number;
}

export interface ScheduledItemMentionCandidate extends ScheduledItemMentionRecord {
    filePath: string;
}

export class ScheduledItemMentionIndex {
    private readonly files = new Map<string, ScheduledItemMentionCandidate[]>();
    private candidates: Record<ScheduledItemKind, ScheduledItemMentionCandidate[]> = { task: [], event: [] };

    replaceFile(filePath: string, records: readonly ScheduledItemMentionRecord[]): void {
        this.files.set(
            filePath,
            records.map((record) => ({ ...record, filePath })),
        );
        this.rebuildKinds();
    }

    replaceAll(files: ReadonlyArray<{ filePath: string; records: readonly ScheduledItemMentionRecord[] }>): void {
        this.files.clear();
        for (const { filePath, records } of files) {
            this.files.set(
                filePath,
                records.map((record) => ({ ...record, filePath })),
            );
        }
        this.rebuildKinds();
    }

    removeFile(filePath: string): void {
        if (!this.files.delete(filePath)) return;
        this.rebuildKinds();
    }

    clear(): void {
        this.files.clear();
        this.candidates = { task: [], event: [] };
    }

    query(kind: ScheduledItemKind, matcher: SuggestionMatcher, limit = 20): ScheduledItemMentionCandidate[] {
        const best: Array<{ candidate: ScheduledItemMentionCandidate; score: number; index: number }> = [];
        for (const [index, candidate] of this.candidates[kind].entries()) {
            const score = matcher(`${candidate.title} ${candidate.filePath}`);
            if (score === null) continue;
            best.push({ candidate, score, index });
            best.sort(
                (a, b) =>
                    a.score - b.score ||
                    Number(a.candidate.completed) - Number(b.candidate.completed) ||
                    a.index - b.index,
            );
            if (best.length > limit) best.pop();
        }
        return best.map(({ candidate }) => candidate);
    }

    private rebuildKinds(): void {
        const all = Array.from(this.files.values()).flat();
        const counts = new Map<string, number>();
        for (const candidate of all) counts.set(candidate.blockId, (counts.get(candidate.blockId) ?? 0) + 1);
        const unambiguous = all.filter((candidate) => counts.get(candidate.blockId) === 1);
        this.candidates = {
            task: unambiguous.filter((candidate) => candidate.kind === "task"),
            event: unambiguous.filter((candidate) => candidate.kind === "event"),
        };
    }
}
