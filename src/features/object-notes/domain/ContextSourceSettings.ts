import type { InsertPosition } from "../../../shared/markdown/InsertPosition";
import type { RequiredPropertySchema } from "./RequiredPropertySchema";

export type ObjectNotePlacement = "flat" | "folder-note";

export interface ContextSourceSettings {
    id: string;
    name: string;
    icon: string;
    folders: string[];
    /** Required frontmatter schema; at most one entry has a non-null identityValue. */
    requiredProperties: RequiredPropertySchema[];
    /** Whether folders[] is required for a note to match this source. */
    matchByFolder: boolean;
    /** Whether the schema's identity entry (if any) is required for a note to match this source. */
    matchByProperty: boolean;
    relatedHeading: string;
    /** Where a new backlink bullet is inserted under relatedHeading. */
    relatedPosition: InsertPosition;
    /** Optional vault-relative template note used when object creation is enabled. */
    templatePath: string;
    /** Default physical shape for new object notes. */
    placement: ObjectNotePlacement;
    enabled: boolean;
    /** Make matching object notes available as a property-filtered Focus Timeline source. */
    includeInTimeline: boolean;
}

/**
 * Persisted registry of contextual Object Sources.
 *
 * The compatibility name reflects the existing `inbox` settings key even
 * though the registry is also consumed by Task capture and Timeline.
 */
export interface InboxSettings {
    contextSources: ContextSourceSettings[];
}
