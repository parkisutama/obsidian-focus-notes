/** One required frontmatter property in an Object Source's schema. */
export interface RequiredPropertySchema {
    /** Frontmatter key, e.g. "type", "region". Unique within one source's list. */
    property: string;
    /**
     * Non-null for at most one entry per source: that entry is the source's identity
     * constraint, used for matching (see ContextSourceScope.identityEntry) and stamped
     * verbatim on creation and repair. Null for entries enforced only through defaultValue.
     */
    identityValue: string | null;
    /**
     * Value used to fill `property` when missing, for entries where identityValue is null.
     * May contain the {{title}}/{{date}}/{{time}} tokens and/or a Templater <% ... %> expression.
     */
    defaultValue: string;
}
