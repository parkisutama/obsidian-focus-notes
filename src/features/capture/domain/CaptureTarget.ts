import type { InsertPosition } from "../../../shared/markdown/InsertPosition";

/**
 * A logging target. The `file` field is a template and may contain
 * `{{date}}` or `{{date:FORMAT}}` tokens for resolution at write time.
 */
export interface FocusTarget {
    file: string;
    heading: string;
    position: InsertPosition;
}
