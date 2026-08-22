import type { InsertPosition } from "../../../shared/markdown/InsertPosition";
import type { ContextSourceFilter } from "./ContextSourceFilter";

export type ObjectNotePlacement = "flat" | "folder-note";

export interface ContextSourceSettings {
    id: string;
    name: string;
    icon: string;
    folders: string[];
    filter: ContextSourceFilter | null;
    /** Whether folders[] is required for a note to match this source. */
    matchByFolder: boolean;
    /** Whether filter is required for a note to match this source. */
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
