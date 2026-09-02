import type { App } from "obsidian";
import { touchedLocalDays } from "../../../features/capture/scheduled-item/domain/EventDayReference.ts";
import {
    createDerivedBlockId,
    formatScheduledItemBlockTarget,
} from "../../../features/capture/scheduled-item/domain/ScheduledItemBlockId.ts";
import {
    formatFocusSessionWeekReferenceLine,
    localWeekKey,
} from "../../../features/focus-session/domain/FocusSessionWeekReference.ts";
import type { FocusSessionOwner } from "../../../features/focus-session/domain/OwnedFocusSession.ts";
import type { FocusNotesSettings } from "../../../features/settings/domain/FocusNotesSettings.ts";
import type { EventTaskWriter } from "../capture/EventTaskWriter.ts";
import { TargetResolver } from "../capture/TargetResolver.ts";
import { getScheduledItemMentionSource } from "../suggestions/ObsidianScheduledItemMentionSource.ts";

export interface FocusSessionWeekProjectionInput {
    owner: FocusSessionOwner;
    start: Date;
    end: Date;
}

/**
 * Projects one owned Focus Session into every Weekly note it touches, as a lightweight aliased
 * reference back to the owning Event/Task — the Weekly counterpart to Event/Task's own Daily
 * reference projection (EventDayProjection/TaskDayProjection), reusing the same
 * canonical-block-plus-reference-line shape.
 *
 * Deliberately write-only for now: a logged session's start/end never change through any path
 * this plugin exposes today, so there's no "previous touched weeks" state to diff against or
 * reconcile — unlike Event/Task, which the user can reschedule. If session editing later gains
 * the ability to move start/end, this is the place to grow a plan/diff step mirroring
 * EventDayReferencePlan.
 *
 * Best-effort: a failed weekly-reference write is logged and swallowed rather than surfaced to
 * the user, since the canonical Focus Session record (the source of truth) has already been
 * written successfully by the time this runs — losing a Weekly cross-reference is a cosmetic
 * miss, not a data-loss risk.
 */
export async function runFocusSessionWeekProjection(
    app: App,
    settings: FocusNotesSettings,
    writer: EventTaskWriter,
    input: FocusSessionWeekProjectionInput,
): Promise<void> {
    const source = getScheduledItemMentionSource(app);
    await source.sync();
    const candidate = source.findCandidate(input.owner.kind, input.owner.itemId);
    if (!candidate) return;

    const resolver = new TargetResolver(settings);
    const canonicalTarget = formatScheduledItemBlockTarget(candidate.filePath, input.owner.itemId);
    const heading = settings.captureFocusSession.heading;
    const position = settings.captureFocusSession.position;

    const weekAnchors = new Map<string, Date>();
    for (const day of touchedLocalDays(input.start, input.end)) {
        const key = localWeekKey(day);
        if (!weekAnchors.has(key)) weekAnchors.set(key, day);
    }

    for (const anchor of weekAnchors.values()) {
        const target = resolver.getPeriodicalTarget("weekly", anchor);
        if (!target?.file) continue;
        const markdown = formatFocusSessionWeekReferenceLine({
            title: candidate.title,
            start: input.start,
            end: input.end,
            canonicalTarget,
            referenceBlockId: createDerivedBlockId("focus-ref"),
        });
        try {
            await writer.writeRelated(markdown, target.file, heading, position);
        } catch (err) {
            console.error("[Focus Notes] weekly Focus Session reference write failed", err);
        }
    }
}
