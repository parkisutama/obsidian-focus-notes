import type { FocusTarget, InboxTargetMode, InsertPosition } from "./types";

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
    mode: InboxTargetMode;
    dailyNoteTarget: FocusTarget | null;
    eventTaskTarget: FocusTarget;
    weeklyNoteTarget: FocusTarget;
    heading: string;
    position: InsertPosition;
}

/** Select the requested file without silently crossing destination modes. */
export function selectInboxTarget(selection: InboxTargetSelection): FocusTarget | null {
    if (selection.mode === "weekly-note") {
        const source = selection.weeklyNoteTarget;
        if (!source.file.trim()) return null;
        return {
            file: source.file,
            // The weekly note's per-day heading must survive; unlike the other
            // modes it is not a fixed "Inbox"/"Moment" heading.
            heading: (source.heading || selection.heading).replace(/^#+\s*/, "").trim(),
            position: selection.position,
        };
    }

    const source = selection.mode === "daily-note" ? selection.dailyNoteTarget : selection.eventTaskTarget;
    if (!source?.file.trim()) return null;

    return {
        file: source.file,
        heading: selection.heading.replace(/^#+\s*/, "").trim(),
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
