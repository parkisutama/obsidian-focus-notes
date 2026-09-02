/**
 * One periodical-note definition: where its files live and how they're named.
 * folder/fileFormat/headingFormat are all Moment.js format strings/templates —
 * see TargetResolver.getPeriodicalTarget() for how they're expanded.
 */
export interface PeriodicalNoteProfile {
    /** Stable id. "daily" is reserved for the built-in Daily profile. */
    id: string;
    /** Display name shown in profile pickers. */
    name: string;
    /** May itself contain {{date:FORMAT}} tokens for a dynamic subfolder. */
    folder: string;
    /** Moment.js format for the file name. */
    fileFormat: string;
    /** Moment.js format for a per-period heading inside the file. Empty = no dated sub-heading. */
    headingFormat: string;
}

export interface PeriodicalNotesSettings {
    profiles: PeriodicalNoteProfile[];
}
