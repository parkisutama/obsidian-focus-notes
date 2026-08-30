import { type App, Notice } from "obsidian";
import { applyCanonicalTaskCompletion } from "../../../features/capture/scheduled-item/domain/TaskCanonicalCompletion.ts";
import { captureLedgerRecord } from "../../../features/capture/scheduled-item/domain/LedgerRecordSource.ts";
import { extractScheduledItemBlockId } from "../../../features/capture/scheduled-item/domain/ScheduledItemBlockId.ts";
import { parseScheduledItemBlock } from "../../../features/capture/scheduled-item/domain/ScheduledItemBlockEditor.ts";
import { ScheduledItemParser } from "../../../features/capture/scheduled-item/domain/ScheduledItemParser.ts";
import {
    planTaskDayReferences,
    type TaskDayReferenceTimebox,
} from "../../../features/capture/scheduled-item/domain/TaskDayReferencePlan.ts";
import { parseLocalDateTime } from "../../../features/capture/scheduled-item/domain/ScheduledItemFormAdapter.ts";
import type { TaskTimebox } from "../../../features/capture/scheduled-item/domain/TaskTimebox.ts";
import type { TaskReferenceCheckboxToggle } from "../../../features/capture/scheduled-item/domain/TaskReferenceCheckboxToggle.ts";
import type { FocusNotesSettings } from "../../../features/settings/domain/FocusNotesSettings.ts";
import {
    type ResolveCanonicalScheduledItemResult,
    resolveCanonicalScheduledItemSource,
} from "./CanonicalScheduledItemResolver.ts";
import { saveScheduledItemBlock } from "./ScheduledItemBlockPersistence.ts";
import { EventTaskWriter } from "./EventTaskWriter.ts";
import { runTaskDayProjection } from "./TaskDayProjectionRuntime.ts";
import type { WriteSuppressionTracker } from "./WriteSuppressionTracker.ts";
import { isTFile } from "../vault/ObsidianFileTypes.ts";

/**
 * Applies one detected Task reference checkbox toggle: resolves the canonical block, writes the
 * completion there first, then reconciles every day/timebox reference. Orphan/ambiguous/invalid
 * canonical targets are reported and never create a canonical write. All writes this function
 * performs go through `tracker` so the caller's own "modify" watcher ignores the resulting events.
 */
export async function syncTaskReferenceCompletion(
    app: App,
    settings: FocusNotesSettings,
    toggle: TaskReferenceCheckboxToggle,
    tracker: WriteSuppressionTracker,
): Promise<void> {
    const resolved = await resolveCanonicalScheduledItemSource(app, toggle.canonicalTarget);
    if (resolved.status !== "resolved") {
        new Notice(referenceResolutionMessage(resolved.status));
        return;
    }

    const file = app.vault.getAbstractFileByPath(resolved.filePath);
    if (!isTFile(file)) return;
    const content = await app.vault.read(file);
    const captured = captureLedgerRecord(content, {
        filePath: resolved.filePath,
        lineNumber: resolved.lineNumber,
        rawLine: resolved.rawLine,
    });
    // The canonical moved or changed between resolving it and reading it just now; safest to
    // drop this attempt rather than guess — the next toggle re-resolves against fresh content.
    if (captured.status !== "captured") return;
    const parsedBlock = parseScheduledItemBlock(captured.snapshot.rawBlock);
    if (parsedBlock.status !== "parsed") return;

    const change = applyCanonicalTaskCompletion(
        parsedBlock.block.firstLine,
        parsedBlock.block.timeboxes,
        toggle.completed,
    );
    if (!change) return;

    tracker.beginSuppress(resolved.filePath);
    try {
        const saved = await saveScheduledItemBlock(app, captured.snapshot, {
            firstLine: change.firstLine,
            description: parsedBlock.block.description,
            detailNote: parsedBlock.block.detailNote,
            timeboxes: change.timeboxes,
        });
        if (saved.status !== "saved" && saved.status !== "unchanged") return;
    } finally {
        tracker.endSuppress(resolved.filePath);
    }

    await reconcileDayReferences(
        app,
        settings,
        resolved.filePath,
        change,
        parsedBlock.block.timeboxes,
        toggle.completed,
        tracker,
    );
}

async function reconcileDayReferences(
    app: App,
    settings: FocusNotesSettings,
    canonicalFilePath: string,
    change: { firstLine: string; timeboxes: TaskTimebox[] },
    previousTimeboxes: readonly TaskTimebox[],
    completed: boolean,
    tracker: WriteSuppressionTracker,
): Promise<void> {
    const canonicalBlockId = extractScheduledItemBlockId(change.firstLine).blockId;
    if (!canonicalBlockId) return;
    const parsedItem = new ScheduledItemParser().parseLine(change.firstLine, {
        groupId: "canonical",
        groupName: "Canonical",
        filePath: canonicalFilePath,
        fileName: canonicalFilePath.split("/").pop() ?? canonicalFilePath,
        lineNumber: 1,
        headingPath: [],
    });
    if (!parsedItem) return;

    const dueDayKey = parsedItem.due ? formatDayKey(parsedItem.due) : null;
    const nextTimeboxes = toProjectionTimeboxes(change.timeboxes);
    const previousPlanTimeboxes = toProjectionTimeboxes(previousTimeboxes);
    const writer = new EventTaskWriter(app, settings.eventTask, () => settings);

    await runTaskDayProjection(
        app,
        settings,
        {
            title: parsedItem.title,
            completed,
            dueDayKey,
            timeboxes: nextTimeboxes,
            canonicalFilePath,
            canonicalBlockId,
            heading: settings.captureTask.heading,
            position: settings.captureTask.position,
        },
        planTaskDayReferences(dueDayKey, previousPlanTimeboxes),
        writer,
        !completed,
        tracker,
    );
}

function toProjectionTimeboxes(timeboxes: readonly TaskTimebox[]): TaskDayReferenceTimebox[] {
    return timeboxes.flatMap((timebox) => {
        const start = parseLocalDateTime(timebox.start, false);
        const end = parseLocalDateTime(timebox.end, false);
        return start && end ? [{ timeboxId: timebox.timeboxId, start, end }] : [];
    });
}

function formatDayKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function referenceResolutionMessage(
    status: Exclude<ResolveCanonicalScheduledItemResult["status"], "resolved">,
): string {
    if (status === "orphan") return "Canonical Task not found for this reference checkbox. It may be stale.";
    if (status === "ambiguous")
        return "Multiple matching canonical Tasks were found; the checkbox change was not applied.";
    return "This reference's canonical link is invalid; the checkbox change was not applied.";
}
