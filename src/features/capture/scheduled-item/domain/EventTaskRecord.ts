import type { EventOccurrenceStatus, TaskPriority } from "./ScheduledItem";
import type { ReflectionBlockFields } from "../../../reflection/domain/ReflectionBlockLine.ts";

interface ReflectiveRecordFields {
    reflection?: ReflectionBlockFields;
    reflectionNotes?: string | null;
}

/** Reference to a hub note, used to build a markdown link. */
export interface HubNoteRef {
    /** Display text for the markdown link (= event/task title). */
    title: string;
    /** Vault-relative path, e.g. "Notes/Team Meeting.md". */
    path: string;
}

export interface EventRecord extends ReflectiveRecordFields {
    kind: "event";
    title: string;
    start: Date;
    end: Date;
    allDay: boolean;
    status: EventOccurrenceStatus;
    actualStart: Date | null;
    actualEnd: Date | null;
    description: string;
    hubNoteRef: HubNoteRef | null;
}

export interface TaskRecord extends ReflectiveRecordFields {
    kind: "task";
    title: string;
    priority: TaskPriority;
    due: Date | null;
    dueHasTime: boolean;
    /** Optional timeblock/timebox: a start–end window for focused work. */
    timebox: { start: Date; end: Date } | null;
    /** All reminder datetimes; multiple means periodic reminders. */
    reminders: Date[];
    description: string;
    hubNoteRef: HubNoteRef | null;
}

export type EventTaskRecord = EventRecord | TaskRecord;
