import type { EventTaskFormState } from "../../domain/EventTaskFormState";
import { parseObjectReferences, type ObjectReference } from "../../domain/ObjectReference.ts";
import type { InsertPosition } from "../../../../shared/markdown/InsertPosition";
import type { EmotionCategory, StressLevel } from "../../../reflection/domain/Wellbeing.ts";
import type { EventLineEdit } from "./EventLineEditor";
import type { EventOccurrenceStatus, TaskPriority } from "./ScheduledItem";
import type { TaskLineEdit } from "./TaskLineEditor";

export type DetailNoteSelection =
    | { mode: "none" }
    | { mode: "link"; path: string }
    | { mode: "create"; name: string; folder: string };

interface ScheduledItemFormBase {
    title: string;
    description: string;
    objectReferences: ObjectReference[];
    detailNote: DetailNoteSelection;
    stressLevel: StressLevel | null;
    emotionCategory: EmotionCategory | null;
    emotionKey: string | null;
    reflectionNotes: string | null;
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
    reflection?: {
        stressLevel: StressLevel | null;
        emotionCategory: EmotionCategory | null;
        emotionKey: string | null;
    };
    reflectionNotes?: string | null;
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
    const childReflection = input.reflection;
    const hasChildReflection = Boolean(
        childReflection &&
            (childReflection.stressLevel !== null ||
                childReflection.emotionCategory !== null ||
                childReflection.emotionKey !== null),
    );
    return {
        kind: "task",
        ...commonFields(input.title, input.description, input.detailNote),
        ...input.edit,
        ...(hasChildReflection ? childReflection : {}),
        reflectionNotes: input.reflectionNotes ?? null,
    };
}

export function scheduledEventFormDataFromLineEdit(input: LineEditAdapterInput<EventLineEdit>): ScheduledEventFormData {
    return {
        kind: "event",
        ...commonFields(input.title, input.description, input.detailNote),
        ...(input.reflection ?? {}),
        reflectionNotes: input.reflectionNotes ?? null,
        ...input.edit,
    };
}

function commonFields(title: string, description: string, detailNote: DetailNoteSelection): ScheduledItemFormBase {
    return {
        title,
        description,
        objectReferences: parseObjectReferences(description).map((occurrence) => occurrence.reference),
        detailNote,
        stressLevel: null,
        emotionCategory: null,
        emotionKey: null,
        reflectionNotes: null,
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
