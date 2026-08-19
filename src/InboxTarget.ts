import type { FocusTarget, InsertPosition } from "./types";

interface InboxTargetResolver {
    resolve(target: FocusTarget, when: Date): FocusTarget;
}

export interface InboxFormTargetState {
    inboxTargetFile: string;
    inboxHeading: string;
    inboxPosition: InsertPosition;
    inboxCapturedAt: Date;
}

export interface InboxTargetSelection {
    /** Moment reuses whatever Event/Task's own active target resolves to, instead of a Periodical Notes profile. */
    useEventCaptureTarget: boolean;
    eventTaskTarget: FocusTarget;
    /** TargetResolver.getPeriodicalTarget(captureMoment.profileId, when) — null when that profile doesn't exist. */
    periodicalTarget: FocusTarget | null;
    heading: string;
    position: InsertPosition;
}

/** Select the requested file without silently crossing destination modes. */
export function selectInboxTarget(selection: InboxTargetSelection): FocusTarget | null {
    if (selection.useEventCaptureTarget) {
        const source = selection.eventTaskTarget;
        if (!source.file.trim()) return null;
        return {
            file: source.file,
            heading: selection.heading.replace(/^#+\s*/, "").trim(),
            position: selection.position,
        };
    }

    const source = selection.periodicalTarget;
    if (!source?.file.trim()) return null;
    return {
        file: source.file,
        // The chosen profile's own per-day heading (if any) must survive;
        // only fall back to the fixed Moment heading when the profile has
        // no dated heading of its own (e.g. a "Daily"-shaped profile).
        heading: (source.heading || selection.heading).replace(/^#+\s*/, "").trim(),
        position: selection.position,
    };
}

/** Resolve per-capture overrides and destination mode identically for every renderer. */
export function resolveInboxFormTarget(resolver: InboxTargetResolver, form: InboxFormTargetState): FocusTarget | null {
    if (!form.inboxTargetFile.trim()) return null;
    return resolver.resolve(
        {
            file: form.inboxTargetFile.trim(),
            heading: form.inboxHeading.replace(/^#+\s*/, "").trim(),
            position: form.inboxPosition,
        },
        form.inboxCapturedAt,
    );
}
