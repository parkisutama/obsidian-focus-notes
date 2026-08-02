import type { FocusTarget, InboxTargetMode, InsertPosition } from "./types";

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
