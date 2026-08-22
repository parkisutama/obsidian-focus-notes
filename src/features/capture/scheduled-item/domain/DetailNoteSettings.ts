export interface EventTaskSettings {
    /** Folder where Event/Task Detail Notes are created. */
    detailNotesFolder: string;
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
