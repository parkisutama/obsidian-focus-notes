import type { App } from "obsidian";
import type { ExistingEventDayReference } from "../../../features/capture/scheduled-item/domain/EventDayReferenceReconciliation.ts";
import { reconcileEventDayReferences } from "../../../features/capture/scheduled-item/domain/EventDayReferenceReconciliation.ts";
import type { ExistingTaskDayReference } from "../../../features/capture/scheduled-item/domain/TaskDayReferenceReconciliation.ts";
import { reconcileTaskDayReferences } from "../../../features/capture/scheduled-item/domain/TaskDayReferenceReconciliation.ts";
import type { FocusNotesSettings } from "../../../features/settings/domain/FocusNotesSettings.ts";
import { EventTaskWriter } from "./EventTaskWriter.ts";
import { runEventDayProjection } from "./EventDayProjectionRuntime.ts";
import { runTaskDayProjection } from "./TaskDayProjectionRuntime.ts";
import { scanVaultForProjectionReconciliation } from "./ProjectionReconciliationScan.ts";
import { TargetResolver } from "./TargetResolver.ts";

export interface ProjectionReconciliationSummary {
    tasksReconciled: number;
    eventsReconciled: number;
    referencesCreated: number;
    referencesRemoved: number;
    failedWrites: number;
    failedRemovals: number;
    orphanTaskReferences: ExistingTaskDayReference[];
    orphanEventReferences: ExistingEventDayReference[];
    ambiguousTaskTargets: string[];
    ambiguousEventTargets: string[];
}

/**
 * Rebuilds every Task/Event day reference in the vault purely from canonical truth. The expected
 * shape (Task 45) is computed by the pure reconciliation functions for reporting — orphan and
 * ambiguous detection they alone can do, since they see the whole vault at once — but the actual
 * create/remove writes for every non-ambiguous canonical item are delegated to the same
 * `runTaskDayProjection`/`runEventDayProjection` used by every incremental edit (Tasks 32/37), so
 * a full rebuild and a single edit can never diverge in how they touch a Daily Note.
 */
export async function runProjectionReconciliation(
    app: App,
    settings: FocusNotesSettings,
): Promise<ProjectionReconciliationSummary> {
    const resolver = new TargetResolver(app, settings);
    const writer = new EventTaskWriter(app, settings.eventTask, () => settings);
    const scan = await scanVaultForProjectionReconciliation(app, {
        resolveDailyFileDate: (filePath) => resolver.resolveDailyFileDate(filePath),
    });

    const taskReport = reconcileTaskDayReferences(scan.tasks, scan.taskReferences);
    const eventReport = reconcileEventDayReferences(scan.events, scan.eventReferences);
    const ambiguousTasks = new Set(taskReport.ambiguousTargets);
    const ambiguousEvents = new Set(eventReport.ambiguousTargets);

    const taskRefsByTarget = groupByTarget(scan.taskReferences);
    let failedWrites = 0;
    let failedRemovals = 0;

    for (const task of scan.tasks) {
        if (ambiguousTasks.has(task.canonicalTarget)) continue;
        const [filePath, canonicalBlockId] = splitCanonicalTarget(task.canonicalTarget);
        const previousPlan = (taskRefsByTarget.get(task.canonicalTarget) ?? []).map((ref) => ({
            date: ref.date,
            due: ref.due,
            timeboxId: ref.timeboxId,
        }));
        const result = await runTaskDayProjection(
            app,
            settings,
            {
                title: task.title,
                completed: task.completed,
                dueDayKey: task.dueDayKey,
                timeboxes: task.timeboxes,
                canonicalFilePath: filePath,
                canonicalBlockId,
                heading: settings.captureTask.heading,
                position: settings.captureTask.position,
            },
            previousPlan,
            writer,
        );
        if (result.status === "partial") {
            failedWrites += result.writeRecovery?.failedWrites.length ?? 0;
            failedRemovals += result.removeRecovery?.failedRemovals.length ?? 0;
        }
    }

    const eventRefsByTarget = groupByTarget(scan.eventReferences);
    for (const event of scan.events) {
        if (ambiguousEvents.has(event.canonicalTarget)) continue;
        const [filePath, canonicalBlockId] = splitCanonicalTarget(event.canonicalTarget);
        const previousDayKeys = (eventRefsByTarget.get(event.canonicalTarget) ?? []).map((ref) => ref.dayKey);
        const result = await runEventDayProjection(
            app,
            settings,
            {
                title: event.title,
                start: event.start,
                end: event.end,
                allDay: event.allDay,
                canonicalFilePath: filePath,
                canonicalBlockId,
                heading: settings.captureEvent.heading,
                position: settings.captureEvent.position,
            },
            previousDayKeys,
            writer,
        );
        if (result.status === "partial") {
            failedWrites += result.writeRecovery?.failedWrites.length ?? 0;
            failedRemovals += result.removeRecovery?.failedRemovals.length ?? 0;
        }
    }

    return {
        tasksReconciled: scan.tasks.length - ambiguousTasks.size,
        eventsReconciled: scan.events.length - ambiguousEvents.size,
        referencesCreated: taskReport.toCreate.length + eventReport.toCreate.length,
        referencesRemoved: taskReport.toRemove.length + eventReport.toRemove.length,
        failedWrites,
        failedRemovals,
        orphanTaskReferences: taskReport.orphanReferences,
        orphanEventReferences: eventReport.orphanReferences,
        ambiguousTaskTargets: taskReport.ambiguousTargets,
        ambiguousEventTargets: eventReport.ambiguousTargets,
    };
}

/** Removes exactly the reported orphan references — an explicit, opt-in repair (Task 45). */
export async function repairOrphanProjectionReferences(
    app: App,
    settings: FocusNotesSettings,
    orphanTaskReferences: readonly ExistingTaskDayReference[],
    orphanEventReferences: readonly ExistingEventDayReference[],
): Promise<void> {
    const writer = new EventTaskWriter(app, settings.eventTask, () => settings);
    for (const ref of orphanTaskReferences) {
        await writer.removeTaskDayReference(ref.destinationPath, ref.canonicalTarget, ref.timeboxId);
    }
    for (const ref of orphanEventReferences) {
        await writer.removeEventDayReference(ref.destinationPath, ref.canonicalTarget);
    }
}

function groupByTarget<T extends { canonicalTarget: string }>(refs: readonly T[]): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const ref of refs) {
        const list = map.get(ref.canonicalTarget) ?? [];
        list.push(ref);
        map.set(ref.canonicalTarget, list);
    }
    return map;
}

function splitCanonicalTarget(target: string): [filePath: string, blockId: string] {
    const [filePath, blockId] = target.split("#^");
    return [filePath, blockId];
}
