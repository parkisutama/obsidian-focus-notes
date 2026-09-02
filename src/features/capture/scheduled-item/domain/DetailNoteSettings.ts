/**
 * How the Detail Note's default folder is resolved on create.
 * - "configured": always `detailNotesFolder`.
 * - "obsidianDefault": follow Obsidian's own "Default location for new notes" setting.
 * - "sourceFolder": same folder as the note that owns the Task/Event's ledger line, falling back
 *   to `detailNotesFolder` when that source is inside the configured Daily Notes folder (a Daily
 *   Note is just a place a Task passes through, not where its Detail Note should live).
 * - "perKind": `detailNotesFolderEvent` for Events, `detailNotesFolderTask` for Tasks.
 */
export type DetailNotesFolderStrategy = "configured" | "obsidianDefault" | "sourceFolder" | "perKind";

export interface EventTaskSettings {
    /** Which strategy resolves the Detail Note's default folder. */
    detailNotesFolderStrategy: DetailNotesFolderStrategy;
    /** Folder where Event/Task Detail Notes are created. Used by the "configured" strategy. */
    detailNotesFolder: string;
    /** Used by the "perKind" strategy for Events. */
    detailNotesFolderEvent: string;
    /** Used by the "perKind" strategy for Tasks. */
    detailNotesFolderTask: string;
    /** Body template for event detail notes. Tokens: {{title}}, {{date}}, {{start}}, {{end}}, {{description}}. */
    eventNoteTemplate: string;
    /** Body template for task detail notes. Tokens: {{title}}, {{date}}, {{due}}, {{start}}, {{end}}, {{remind}}, {{description}}. */
    taskNoteTemplate: string;
    /** Format for the `related` frontmatter field (links to target/daily note). {{date}} = event/task date, {{targetFile}} = target path. Empty = omit. */
    relatedFieldFormat: string;
    /** Include `status` field in detail note frontmatter. */
    includeStatus: boolean;
    /** Include `priority` field in task detail note frontmatter. */
    includePriority: boolean;
    /** Include `tags` field in detail note frontmatter. */
    includeTags: boolean;
}
