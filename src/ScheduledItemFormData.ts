import type { EventLineEdit } from "./EventLineEditor";
import type { EventTaskFormState } from "./EventTaskFormState";
import { parseObjectReferences, type ObjectReference } from "./ObjectReference.ts";
import type { EventOccurrenceStatus, TaskPriority } from "./ScheduledItemTypes";
import type { TaskLineEdit } from "./TaskLineEditor";
import type { InsertPosition } from "./types";

export type DetailNoteSelection =
    | { mode: "none" }
    | { mode: "link"; path: string }
    | { mode: "create"; name: string; folder: string };

interface ScheduledItemFormBase {
    title: string;
    description: string;
    objectReferences: ObjectReference[];
    detailNote: DetailNoteSelection;
}

export interface ScheduledTaskFormData extends ScheduledItemFormBase {
    kind: "task";
    completed: boolean;
    priority: TaskPriority;
    due: string | null;
    timebox: { start: string; end: string } | null;
    reminders: string[];
}

export interface ScheduledEventFormData extends ScheduledItemFormBase {
    kind: "event";
    allDay: boolean;
    start: string;
    end: string | null;
    status: EventOccurrenceStatus;
    actual: { start: string; end: string } | null;
}

export type ScheduledItemFormData = ScheduledTaskFormData | ScheduledEventFormData;

export type ScheduledItemFormPersistenceContext =
    | {
          mode: "create";
          targetFile: string;
          targetHeading: string;
          targetPosition: InsertPosition;
      }
    | {
          mode: "edit";
          sourcePath: string;
          sourceLine: number;
          sourceText: string;
      };

interface LineEditAdapterInput<TEdit> {
    title: string;
    description: string;
    detailNote: DetailNoteSelection;
    edit: TEdit;
}

export function scheduledItemFormDataFromCreateState(state: EventTaskFormState): ScheduledItemFormData {
    if (state.kind === "inbox") throw new Error("Inbox captures are not Scheduled Items.");

    const common = commonFields(state.title, state.description, detailNoteFromCreateState(state));
    if (state.kind === "event") {
        return {
            kind: "event",
            ...common,
            allDay: state.eventAllDay,
            start: state.eventAllDay ? state.eventDate : joinDateTime(state.eventDate, state.eventStartTime),
            end: state.eventAllDay ? null : joinDateTime(state.eventDate, state.eventEndTime),
            status: state.eventStatus,
            actual:
                state.eventActualTimeEnabled && state.eventStatus === "completed"
                    ? {
                          start: joinDateTime(state.eventActualStartDate, state.eventActualStartTime),
                          end: joinDateTime(state.eventActualEndDate, state.eventActualEndTime),
                      }
                    : null,
        };
    }

    return {
        kind: "task",
        ...common,
        completed: false,
        priority: state.taskPriority,
        due: state.taskDueDate
            ? state.taskDueHasTime
                ? joinDateTime(state.taskDueDate, state.taskDueTime)
                : state.taskDueDate
            : null,
        timebox:
            state.taskTimeboxEnabled && state.taskTimeboxDate
                ? {
                      start: joinDateTime(state.taskTimeboxDate, state.taskTimeboxStartTime),
                      end: joinDateTime(state.taskTimeboxDate, state.taskTimeboxEndTime),
                  }
                : null,
        reminders: state.reminders
            .filter((reminder) => reminder.date)
            .map((reminder) => joinDateTime(reminder.date, reminder.time || "09:00")),
    };
}

export function scheduledTaskFormDataFromLineEdit(input: LineEditAdapterInput<TaskLineEdit>): ScheduledTaskFormData {
    return { kind: "task", ...commonFields(input.title, input.description, input.detailNote), ...input.edit };
}

export function scheduledEventFormDataFromLineEdit(input: LineEditAdapterInput<EventLineEdit>): ScheduledEventFormData {
    return { kind: "event", ...commonFields(input.title, input.description, input.detailNote), ...input.edit };
}

function commonFields(title: string, description: string, detailNote: DetailNoteSelection): ScheduledItemFormBase {
    return {
        title,
        description,
        objectReferences: parseObjectReferences(description).map((occurrence) => occurrence.reference),
        detailNote,
    };
}

function detailNoteFromCreateState(state: EventTaskFormState): DetailNoteSelection {
    return state.detailNoteEnabled
        ? { mode: "create", name: state.detailNoteName, folder: state.detailNoteFolder }
        : { mode: "none" };
}

function joinDateTime(date: string, time: string): string {
    return `${date} ${time}`;
}
