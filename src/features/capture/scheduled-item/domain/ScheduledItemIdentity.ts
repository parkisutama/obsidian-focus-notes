import type { ScheduledItemKind } from "./ScheduledItem.ts";

export interface ScheduledItemIdentityLocation {
    blockId: string;
    filePath: string;
    lineNumber: number;
}

export interface CanonicalScheduledItemIdentity extends ScheduledItemIdentityLocation {
    entryType: "canonical";
    itemId: string;
    kind: ScheduledItemKind;
}

export interface ScheduledItemReferenceIdentity extends ScheduledItemIdentityLocation {
    entryType: "reference";
    itemId: string;
    kind: ScheduledItemKind;
    timeboxId: string | null;
    sessionId: string | null;
}

export type ScheduledItemIdentityRecord = CanonicalScheduledItemIdentity | ScheduledItemReferenceIdentity;

export type ScheduledItemReferenceResolution =
    | {
          status: "resolved";
          reference: ScheduledItemReferenceIdentity;
          canonical: CanonicalScheduledItemIdentity;
      }
    | {
          status: "orphan";
          reference: ScheduledItemReferenceIdentity;
      }
    | {
          status: "ambiguous";
          reference: ScheduledItemReferenceIdentity;
          canonicals: CanonicalScheduledItemIdentity[];
      }
    | { status: "ambiguous-reference"; references: ScheduledItemReferenceIdentity[] }
    | { status: "missing-reference" };
