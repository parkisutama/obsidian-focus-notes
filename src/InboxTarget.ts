import type { FocusTarget, InboxTargetMode, InsertPosition } from "./types";

interface InboxTargetResolver {
    resolve(target: FocusTarget, when: Date): FocusTarget;
    getDailyNoteTarget(when: Date): FocusTarget | null;
}

export interface InboxFormTargetState {
    inboxTargetFileOverride: string;
    inboxTargetMode: InboxTargetMode;
    inboxHeading: string;
    inboxPosition: InsertPosition;
    inboxCapturedAt: Date;
    targetFile: string;
    targetHeading: string;
    targetPosition: InsertPosition;
}

export interface InboxTargetSelection {
    mode: InboxTargetMode;
    dailyNoteTarget: FocusTarget | null;
    eventTaskTarget: FocusTarget;
    heading: string;
    position: InsertPosition;
}

/** Select the requested file without silently crossing destination modes. */
export function selectInboxTarget(selection: InboxTargetSelection): FocusTarget | null {
    const source = selection.mode === "daily-note"
        ? selection.dailyNoteTarget
        : selection.eventTaskTarget;
    if (!source?.file.trim()) return null;

    return {
        file: source.file,
        heading: selection.heading.replace(/^#+\s*/, "").trim(),
        position: selection.position
    };
}

/** Resolve per-capture overrides and destination mode identically for every renderer. */
export function resolveInboxFormTarget(
    resolver: InboxTargetResolver,
    form: InboxFormTargetState
): FocusTarget | null {
    const fileOverride = form.inboxTargetFileOverride.trim();
    if (fileOverride) {
        return resolver.resolve({
            file: fileOverride,
            heading: form.inboxHeading.replace(/^#+\s*/, "").trim(),
            position: form.inboxPosition
        }, form.inboxCapturedAt);
    }

    return selectInboxTarget({
        mode: form.inboxTargetMode,
        dailyNoteTarget: resolver.getDailyNoteTarget(form.inboxCapturedAt),
        eventTaskTarget: resolver.resolve({
            file: form.targetFile,
            heading: form.targetHeading,
            position: form.targetPosition
        }, form.inboxCapturedAt),
        heading: form.inboxHeading,
        position: form.inboxPosition
    });
}
