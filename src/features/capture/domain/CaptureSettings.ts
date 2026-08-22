import type { InsertPosition } from "../../../shared/markdown/InsertPosition";

/** Which Periodical Notes profile + heading + position one capture kind writes to. */
export interface CaptureHeadingTarget {
    profileId: string;
    /** Used verbatim when the resolved profile's headingFormat is empty. */
    heading: string;
    position: InsertPosition;
}

export type FocusSessionCaptureSettings = CaptureHeadingTarget;

export interface EventCaptureSettings extends CaptureHeadingTarget {
    hubNotesFolder: string;
}

/**
 * Task targets an Object Note rather than a Periodical Notes profile — a task
 * belongs in a project/task-list page, not a dated note. allowedSourceIds
 * scopes the "Save to" picker to notes from those Object Sources (combined,
 * deduplicated, ranked the same way the @ mention suggester already ranks
 * them); free-text path entry with full-vault suggestions remains available
 * when nothing configured matches what's typed.
 */
export interface TaskCaptureSettings {
    allowedSourceIds: string[];
    heading: string;
    position: InsertPosition;
    hubNotesFolder: string;
}

/**
 * Where new Moments default to. Unlike Event, Moment can also just reuse
 * whatever Event/Task's own active target resolves to (useEventCaptureTarget)
 * instead of a Periodical Notes profile. The optional backlink writes a
 * second short entry into another profile's file (e.g. a same-day line in
 * the Daily profile when the Moment itself lands in the Weekly profile).
 */
export interface MomentCaptureSettings {
    useEventCaptureTarget: boolean;
    /** Used when useEventCaptureTarget is false. */
    profileId: string;
    /** Fixed heading; used when useEventCaptureTarget is true, or the resolved profile has no headingFormat. */
    heading: string;
    position: InsertPosition;
    backlink: MomentBacklinkSettings;
}

export interface MomentBacklinkSettings {
    enabled: boolean;
    profileId: string;
    heading: string;
    position: InsertPosition;
}
