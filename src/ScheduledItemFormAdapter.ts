import { editEventLineWithTitle, parseEventLineEdit } from "./EventLineEditor.ts";
import type { EventTaskRecord } from "./EventTaskWriter";
import type { LedgerRecordSnapshot } from "./LedgerRecordSource.ts";
import { normalizeObjectReferencePath, parseObjectReferences } from "./ObjectReference.ts";
import {
    parseScheduledItemBlock,
    type ScheduledItemBlockDetail,
    type ScheduledItemBlockEdit,
} from "./ScheduledItemBlockEditor.ts";
import {
    scheduledEventFormDataFromLineEdit,
    scheduledTaskFormDataFromLineEdit,
    type DetailNoteSelection,
    type ScheduledItemFormData,
} from "./ScheduledItemFormData.ts";
import { editTaskLineWithTitle, type FormatDateValue, parseTaskLineEdit } from "./TaskLineEditor.ts";

export type ScheduledItemFormField =
    | "title"
    | "objectReferences"
    | "detailNote"
    | "due"
    | "timebox"
    | "reminders"
    | "start"
    | "end"
    | "actual";

export type ScheduledItemFormValidation =
    | { valid: true }
    | { valid: false; field: ScheduledItemFormField; message: string };

export type HydrateScheduledItemFormResult =
    | { status: "ready"; data: ScheduledItemFormData }
    | { status: "invalid"; reason: string };

export type BuildScheduledItemFormBlockResult =
    | { status: "ready"; edit: ScheduledItemBlockEdit }
    | { status: "invalid"; field: ScheduledItemFormField; message: string };

export type BuildScheduledItemRecordResult =
    | { status: "ready"; record: EventTaskRecord }
    | { status: "invalid"; field: ScheduledItemFormField; message: string };

export function hydrateScheduledItemFormEdit(input: {
    kind: "task" | "event";
    title: string;
    snapshot: LedgerRecordSnapshot;
}): HydrateScheduledItemFormResult {
    const block = parseScheduledItemBlock(input.snapshot.rawBlock);
    if (block.status === "invalid") return block;
    const detailNote = detailSelectionFromBlock(block.block.detailNote);

    if (input.kind === "task") {
        const parsed = parseTaskLineEdit(block.block.firstLine);
        if (parsed.status === "invalid") return parsed;
        return {
            status: "ready",
            data: scheduledTaskFormDataFromLineEdit({
                title: input.title,
                description: block.block.description,
                detailNote,
                edit: parsed.edit,
            }),
        };
    }

    const parsed = parseEventLineEdit(block.block.firstLine);
    if (parsed.status === "invalid") return parsed;
    return {
        status: "ready",
        data: scheduledEventFormDataFromLineEdit({
            title: input.title,
            description: block.block.description,
            detailNote,
            edit: parsed.edit,
        }),
    };
}

export function validateScheduledItemFormData(data: ScheduledItemFormData): ScheduledItemFormValidation {
    if (!data.title.trim()) return invalid("title", "Title is required.");
    if (/\r|\n| \| /.test(data.title)) return invalid("title", "Title contains reserved Markdown syntax.");

    const parsedReferences = parseObjectReferences(data.description).map((occurrence) => occurrence.reference);
    if (JSON.stringify(parsedReferences) !== JSON.stringify(data.objectReferences)) {
        return invalid("objectReferences", "Object References are out of sync with the description.");
    }
    if (data.detailNote.mode === "link") {
        const normalized = normalizeObjectReferencePath(data.detailNote.path);
        if (normalized === null || normalized !== data.detailNote.path) {
            return invalid("detailNote", "Detail Note must use a vault-root Markdown path.");
        }
    }
    if (data.detailNote.mode === "create" && !data.detailNote.name.trim()) {
        return invalid("detailNote", "Detail Note name is required.");
    }

    if (data.kind === "task") return validateTask(data);
    return validateEvent(data);
}

export function buildScheduledItemFormBlockEdit(
    data: ScheduledItemFormData,
    snapshot?: LedgerRecordSnapshot,
    formatDateValue?: FormatDateValue,
): BuildScheduledItemFormBlockResult {
    const validation = validateScheduledItemFormData(data);
    if (!validation.valid) return buildInvalid(validation.field, validation.message);

    const sourceLine = snapshot?.rawLine ?? canonicalPlaceholder(data);
    const lineResult =
        data.kind === "task"
            ? editTaskLineWithTitle(
                  sourceLine,
                  data.title,
                  {
                      completed: data.completed,
                      priority: data.priority,
                      due: data.due,
                      timebox: data.timebox,
                      reminders: data.reminders,
                  },
                  formatDateValue,
              )
            : editEventLineWithTitle(sourceLine, data.title, {
                  allDay: data.allDay,
                  start: data.start,
                  end: data.end,
                  status: data.status,
                  actual: data.actual,
              });
    if (lineResult.status === "invalid") {
        return buildInvalid(data.kind === "task" ? "due" : "start", "Scheduled Item fields are invalid.");
    }

    const currentDetail = snapshot ? currentBlockDetail(snapshot) : { mode: "none" as const };
    return {
        status: "ready",
        edit: {
            firstLine: lineResult.line,
            description: data.description,
            detailNote: detailBlockFromSelection(data.detailNote, data.title, currentDetail),
        },
    };
}

export function buildScheduledItemRecord(data: ScheduledItemFormData): BuildScheduledItemRecordResult {
    const validation = validateScheduledItemFormData(data);
    if (!validation.valid) return buildInvalid(validation.field, validation.message);

    if (data.kind === "event") {
        const start = parseLocalDateTime(data.start, data.allDay);
        if (!start) return buildInvalid("start", "Event start is invalid.");
        const end = data.allDay
            ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1)
            : parseLocalDateTime(data.end ?? "", false);
        if (!end) return buildInvalid("end", "Event end is invalid.");
        return {
            status: "ready",
            record: {
                kind: "event",
                title: data.title.trim(),
                start,
                end,
                allDay: data.allDay,
                status: data.status,
                actualStart: data.actual ? parseLocalDateTime(data.actual.start, false) : null,
                actualEnd: data.actual ? parseLocalDateTime(data.actual.end, false) : null,
                description: data.description,
                hubNoteRef: null,
            },
        };
    }

    const due = data.due ? parseLocalDateTime(data.due, true) : null;
    return {
        status: "ready",
        record: {
            kind: "task",
            title: data.title.trim(),
            priority: data.priority,
            due,
            dueHasTime: data.due?.includes(" ") ?? false,
            timebox: data.timebox
                ? {
                      start: parseLocalDateTime(data.timebox.start, false) as Date,
                      end: parseLocalDateTime(data.timebox.end, false) as Date,
                  }
                : null,
            reminders: data.reminders.map((value) => parseLocalDateTime(value, false) as Date),
            description: data.description,
            hubNoteRef: null,
        },
    };
}

function validateTask(data: Extract<ScheduledItemFormData, { kind: "task" }>): ScheduledItemFormValidation {
    if (data.due && !parseLocalDateTime(data.due, true)) return invalid("due", "Task due date is invalid.");
    if (data.timebox) {
        const start = parseLocalDateTime(data.timebox.start, false);
        const end = parseLocalDateTime(data.timebox.end, false);
        if (!start || !end || end <= start) return invalid("timebox", "Task timebox end must be later than start.");
    }
    if (data.reminders.some((value) => !parseLocalDateTime(value, false))) {
        return invalid("reminders", "Task reminder is invalid.");
    }
    return { valid: true };
}

function validateEvent(data: Extract<ScheduledItemFormData, { kind: "event" }>): ScheduledItemFormValidation {
    const start = parseLocalDateTime(data.start, data.allDay);
    if (!start) return invalid("start", "Event start is invalid.");
    if (data.allDay && data.end !== null) return invalid("end", "All-day Event cannot include an end time.");
    if (!data.allDay) {
        const end = data.end ? parseLocalDateTime(data.end, false) : null;
        if (!end || end <= start) return invalid("end", "Event end must be later than start.");
    }
    if (data.actual && data.status !== "completed") {
        return invalid("actual", "Actual time requires a completed Event.");
    }
    if (data.actual) {
        const actualStart = parseLocalDateTime(data.actual.start, false);
        const actualEnd = parseLocalDateTime(data.actual.end, false);
        if (!actualStart || !actualEnd || actualEnd <= actualStart) {
            return invalid("actual", "Event actual end must be later than actual start.");
        }
    }
    return { valid: true };
}

function canonicalPlaceholder(data: ScheduledItemFormData): string {
    return data.kind === "task" ? `- [ ] ${data.title}` : `- 2000-01-01 00:00 - 01:00 ${data.title}`;
}

function detailSelectionFromBlock(detail: ScheduledItemBlockDetail): DetailNoteSelection {
    return detail.mode === "link" ? { mode: "link", path: detail.path } : { mode: "none" };
}

function currentBlockDetail(snapshot: LedgerRecordSnapshot): ScheduledItemBlockDetail {
    const parsed = parseScheduledItemBlock(snapshot.rawBlock);
    return parsed.status === "parsed" ? parsed.block.detailNote : { mode: "none" };
}

function detailBlockFromSelection(
    selection: DetailNoteSelection,
    itemTitle: string,
    current: ScheduledItemBlockDetail,
): ScheduledItemBlockDetail {
    if (selection.mode !== "link") return { mode: "none" };
    if (current.mode === "link" && current.path === selection.path) return current;
    return { mode: "link", title: itemTitle, path: selection.path };
}

export function parseLocalDateTime(value: string, allowDateOnly: boolean): Date | null {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?$/);
    if (!match || (!allowDateOnly && match[4] === undefined)) return null;
    const [year, month, day, hour, minute] = [match[1], match[2], match[3], match[4] ?? "0", match[5] ?? "0"].map(
        Number,
    );
    const result = new Date(year, month - 1, day, hour, minute);
    return result.getFullYear() === year &&
        result.getMonth() === month - 1 &&
        result.getDate() === day &&
        result.getHours() === hour &&
        result.getMinutes() === minute
        ? result
        : null;
}

function invalid(field: ScheduledItemFormField, message: string) {
    return { valid: false as const, field, message };
}

function buildInvalid(
    field: ScheduledItemFormField,
    message: string,
): { status: "invalid"; field: ScheduledItemFormField; message: string } {
    return { status: "invalid", field, message };
}
