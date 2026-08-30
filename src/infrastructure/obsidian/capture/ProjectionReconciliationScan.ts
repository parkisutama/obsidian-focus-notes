import type { App, TFile } from "obsidian";
import {
    classifyScheduledItemBlockId,
    formatScheduledItemBlockTarget,
} from "../../../features/capture/scheduled-item/domain/ScheduledItemBlockId.ts";
import { ScheduledItemParser } from "../../../features/capture/scheduled-item/domain/ScheduledItemParser.ts";
import { captureLedgerRecord } from "../../../features/capture/scheduled-item/domain/LedgerRecordSource.ts";
import { parseScheduledItemBlock } from "../../../features/capture/scheduled-item/domain/ScheduledItemBlockEditor.ts";
import { parseLocalDateTime } from "../../../features/capture/scheduled-item/domain/ScheduledItemFormAdapter.ts";
import { localDayKey, touchedLocalDays } from "../../../features/capture/scheduled-item/domain/EventDayReference.ts";
import { parseTaskDayReferenceLine } from "../../../features/capture/scheduled-item/domain/TaskDayReference.ts";
import { parseEventDayReferenceLine } from "../../../features/capture/scheduled-item/domain/EventDayReference.ts";
import type {
    TaskCanonicalSnapshot,
    ExistingTaskDayReference,
} from "../../../features/capture/scheduled-item/domain/TaskDayReferenceReconciliation.ts";
import type {
    EventCanonicalSnapshot,
    ExistingEventDayReference,
} from "../../../features/capture/scheduled-item/domain/EventDayReferenceReconciliation.ts";

/** Adds the display/write fields `runTaskDayProjection` needs beyond what reconciliation itself reads. */
export interface ScannedTaskCanonical extends TaskCanonicalSnapshot {
    title: string;
    completed: boolean;
}

/** Adds the display/write fields `runEventDayProjection` needs beyond what reconciliation itself reads. */
export interface ScannedEventCanonical extends EventCanonicalSnapshot {
    title: string;
    start: Date;
    end: Date | null;
    allDay: boolean;
}

export interface ProjectionReconciliationScanResult {
    tasks: ScannedTaskCanonical[];
    events: ScannedEventCanonical[];
    taskReferences: ExistingTaskDayReference[];
    eventReferences: ExistingEventDayReference[];
}

export interface ProjectionReconciliationScanDependencies {
    /** Recovers the calendar date a Daily-projection destination file represents, or null. */
    resolveDailyFileDate: (filePath: string) => Date | null;
}

interface BlockCacheLike {
    position: { start: { line: number } };
}

const RELEVANT_BLOCK_ID = /^(?:task|event|task-ref|event-ref)-/;

/**
 * Vault-wide collector for Task 45's reconciliation: every canonical Task/Event block (with
 * enough context to recompute its expected day references) plus every existing Task/Event day
 * reference already on disk. Kept free of any real Obsidian value import — `resolveDailyFileDate`
 * is injected — so this stays directly unit-testable against a mocked `App`, mirroring
 * `ScheduledItemIndexer`'s established pattern.
 */
export async function scanVaultForProjectionReconciliation(
    app: App,
    deps: ProjectionReconciliationScanDependencies,
): Promise<ProjectionReconciliationScanResult> {
    const parser = new ScheduledItemParser();
    const tasks: ScannedTaskCanonical[] = [];
    const events: ScannedEventCanonical[] = [];
    const taskReferences: ExistingTaskDayReference[] = [];
    const eventReferences: ExistingEventDayReference[] = [];

    for (const mdFile of app.vault.getMarkdownFiles()) {
        const blocks = relevantBlocks(app, mdFile);
        if (blocks.length === 0) continue;
        const content = await app.vault.cachedRead(mdFile);
        const lines = content.split(/\r?\n/);

        for (const [blockId, lineNumber] of blocks) {
            const rawLine = lines[lineNumber - 1];
            if (!rawLine) continue;
            const kind = classifyScheduledItemBlockId(blockId);

            if (kind === "task" || kind === "event") {
                collectCanonicalItem(parser, mdFile, blockId, lineNumber, rawLine, content, tasks, events);
            } else if (kind === "task-reference") {
                collectTaskReference(rawLine, mdFile, deps, taskReferences);
            } else if (kind === "event-reference") {
                collectEventReference(rawLine, mdFile, deps, eventReferences);
            }
        }
    }

    return { tasks, events, taskReferences, eventReferences };
}

function collectCanonicalItem(
    parser: ScheduledItemParser,
    file: TFile,
    blockId: string,
    lineNumber: number,
    rawLine: string,
    content: string,
    tasks: ScannedTaskCanonical[],
    events: ScannedEventCanonical[],
): void {
    const item = parser.parseLine(rawLine, {
        groupId: "",
        groupName: "",
        filePath: file.path,
        fileName: file.basename,
        lineNumber,
        headingPath: [],
    });
    if (!item || item.blockId !== blockId) return;
    const canonicalTarget = formatScheduledItemBlockTarget(file.path, blockId);

    if (item.kind === "event") {
        if (!item.start) return;
        events.push({
            canonicalTarget,
            canonicalDayKey: localDayKey(item.start),
            touchedDayKeys: touchedLocalDays(item.start, item.end ?? item.start).map(localDayKey),
            title: item.title,
            start: item.start,
            end: item.end,
            allDay: item.allDay,
        });
        return;
    }

    const captured = captureLedgerRecord(content, { filePath: file.path, lineNumber, rawLine });
    const parsedBlock = captured.status === "captured" ? parseScheduledItemBlock(captured.snapshot.rawBlock) : null;
    const timeboxes =
        parsedBlock?.status === "parsed"
            ? parsedBlock.block.timeboxes.flatMap((timebox) => {
                  const start = parseLocalDateTime(timebox.start, false);
                  const end = parseLocalDateTime(timebox.end, false);
                  return start && end ? [{ timeboxId: timebox.timeboxId, start, end }] : [];
              })
            : [];
    tasks.push({
        canonicalTarget,
        dueDayKey: item.due ? localDayKey(item.due) : null,
        timeboxes,
        title: item.title,
        completed: item.isCompleted,
    });
}

function collectTaskReference(
    rawLine: string,
    file: TFile,
    deps: ProjectionReconciliationScanDependencies,
    out: ExistingTaskDayReference[],
): void {
    const parsed = parseTaskDayReferenceLine(rawLine);
    if (!parsed) return;
    const date = deps.resolveDailyFileDate(file.path);
    if (!date) return;
    out.push({
        canonicalTarget: parsed.canonicalTarget,
        destinationPath: file.path,
        date: localDayKey(date),
        due: parsed.due,
        timeboxId: parsed.timeboxId,
    });
}

function collectEventReference(
    rawLine: string,
    file: TFile,
    deps: ProjectionReconciliationScanDependencies,
    out: ExistingEventDayReference[],
): void {
    const parsed = parseEventDayReferenceLine(rawLine);
    if (!parsed) return;
    const date = deps.resolveDailyFileDate(file.path);
    if (!date) return;
    out.push({ canonicalTarget: parsed.canonicalTarget, destinationPath: file.path, dayKey: localDayKey(date) });
}

function relevantBlocks(app: App, file: TFile): Array<[string, number]> {
    const cache = app.metadataCache.getFileCache(file) as { blocks?: Record<string, BlockCacheLike> } | null;
    return Object.entries(cache?.blocks ?? {})
        .filter(([id]) => RELEVANT_BLOCK_ID.test(id))
        .map(([id, block]) => [id, block.position.start.line + 1]);
}
