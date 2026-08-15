import type { EventTaskRecord, HubNoteRef, TaskRecord } from "./EventTaskWriter";
import type { InboxSettings, InsertPosition } from "./types";
import type { EventOccurrenceStatus, TaskPriority } from "./ScheduledItemTypes";

export type EventTaskKind = "inbox" | "event" | "task";
export type HubMode = "none" | "link" | "create";

export interface InboxRecord {
    kind: "inbox";
    capturedAt: Date;
    defaultTitle: string;
    title: string;
    body: string;
}

export type CaptureRecord = EventTaskRecord | InboxRecord;

export interface ReminderEntry {
    date: string;
    time: string;
}

export interface EventTaskFormDefaults {
    file: string;
    heading: string;
    position: InsertPosition;
    hubNotesFolder: string;
    detailNotesFolder: string;
    inbox?: InboxSettings;
    inboxTargetFile?: string;
}

export type TemporalValidationResult = { valid: true } | { valid: false; message: string };

export function formatLocalDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatLocalDateTime(date: Date): string {
    return `${formatLocalDate(date)} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** Renderer-independent values entered in the event/task form. */
export class EventTaskFormState {
    kind: EventTaskKind = "inbox";

    readonly inboxCapturedAt: Date;
    readonly inboxDefaultTitle: string;
    inboxTitle: string;
    inboxBody = "";
    inboxTargetFile: string;
    inboxHeading: string;
    inboxPosition: InsertPosition;

    eventDate: string;
    eventStartTime: string;
    eventEndTime: string;
    eventAllDay = false;
    eventStatus: EventOccurrenceStatus = "planned";
    eventActualTimeEnabled = false;
    eventActualStartDate: string;
    eventActualStartTime: string;
    eventActualEndDate: string;
    eventActualEndTime: string;

    taskDueDate: string;
    taskDueTime = "09:00";
    taskDueHasTime = false;
    taskPriority: TaskPriority = "normal";
    taskTimeboxEnabled = false;
    taskTimeboxDate: string;
    taskTimeboxStartTime: string;
    taskTimeboxEndTime: string;
    reminders: ReminderEntry[] = [];

    title = "";
    description = "";
    hubMode: HubMode = "none";
    hubLinkPath = "";
    hubCreateName = "";
    hubCreateFolder: string;
    writeToHubNote = false;
    detailNoteEnabled = false;
    detailNoteName = "";
    detailNoteFolder: string;

    targetFile: string;
    targetHeading: string;
    targetPosition: InsertPosition;

    constructor(anchorDate: Date, defaults: EventTaskFormDefaults) {
        const inboxDefaults = defaults.inbox ?? {
            defaultTargetMode: "daily-note",
            heading: "Inbox",
            position: "end",
            contextSources: [],
        };
        this.inboxCapturedAt = new Date(anchorDate.getTime());
        this.inboxDefaultTitle = formatLocalDateTime(this.inboxCapturedAt);
        this.inboxTitle = this.inboxDefaultTitle;
        this.inboxTargetFile = defaults.inboxTargetFile ?? "";
        this.inboxHeading = inboxDefaults.heading;
        this.inboxPosition = inboxDefaults.position;

        const hour = anchorDate.getHours();
        this.eventDate = formatLocalDate(anchorDate);
        this.eventStartTime = `${String(hour).padStart(2, "0")}:00`;
        this.eventEndTime = hour === 23 ? "23:59" : `${String(hour + 1).padStart(2, "0")}:00`;
        this.eventActualStartDate = this.eventDate;
        this.eventActualStartTime = this.eventStartTime;
        this.eventActualEndDate = this.eventDate;
        this.eventActualEndTime = this.eventEndTime;
        this.taskDueDate = this.eventDate;
        this.taskTimeboxDate = this.eventDate;
        this.taskTimeboxStartTime = this.eventStartTime;
        this.taskTimeboxEndTime = this.eventEndTime;

        this.targetFile = defaults.file;
        this.targetHeading = defaults.heading;
        this.targetPosition = defaults.position;
        this.hubCreateFolder = defaults.hubNotesFolder;
        this.detailNoteFolder = defaults.detailNotesFolder;
    }

    buildRecord(hubNoteRef: HubNoteRef | null): EventTaskRecord {
        if (this.kind === "event") {
            const eventTime = this.eventAllDay ? "00:00" : this.eventStartTime;
            const start = this.parseDateTime(this.eventDate, eventTime);
            const end = this.eventAllDay
                ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1)
                : this.parseDateTime(this.eventDate, this.eventEndTime);
            const actualStart =
                this.eventStatus === "completed" && this.eventActualTimeEnabled
                    ? this.parseDateTime(this.eventActualStartDate, this.eventActualStartTime)
                    : null;
            const actualEnd =
                this.eventStatus === "completed" && this.eventActualTimeEnabled
                    ? this.parseDateTime(this.eventActualEndDate, this.eventActualEndTime)
                    : null;
            return {
                kind: "event",
                title: this.title.trim(),
                start,
                end,
                allDay: this.eventAllDay,
                status: this.eventStatus,
                actualStart,
                actualEnd,
                description: this.description,
                hubNoteRef,
            };
        }

        if (this.kind === "inbox") {
            throw new Error("Inbox captures must use buildInboxRecord().");
        }

        const reminders = this.reminders
            .filter((reminder) => reminder.date)
            .map((reminder) => this.parseDateTime(reminder.date, reminder.time || "09:00"));
        const timebox: TaskRecord["timebox"] =
            this.taskTimeboxEnabled && this.taskTimeboxDate
                ? {
                      start: this.parseDateTime(this.taskTimeboxDate, this.taskTimeboxStartTime),
                      end: this.parseDateTime(this.taskTimeboxDate, this.taskTimeboxEndTime),
                  }
                : null;

        return {
            kind: "task",
            title: this.title.trim(),
            priority: this.taskPriority,
            due: this.taskDueDate
                ? this.parseDateTime(this.taskDueDate, this.taskDueHasTime ? this.taskDueTime : "00:00")
                : null,
            dueHasTime: this.taskDueHasTime,
            timebox,
            reminders,
            description: this.description,
            hubNoteRef,
        };
    }

    buildInboxRecord(): InboxRecord {
        return {
            kind: "inbox",
            capturedAt: new Date(this.inboxCapturedAt.getTime()),
            defaultTitle: this.inboxDefaultTitle,
            title: this.inboxTitle.trim(),
            body: this.inboxBody,
        };
    }

    getTitleForKind(kind: EventTaskKind): string {
        return kind === "inbox" ? this.inboxTitle : this.title;
    }

    setTitleForKind(kind: EventTaskKind, value: string): void {
        if (kind === "inbox") this.inboxTitle = value;
        else this.title = value;
    }

    validateTemporalFields(): TemporalValidationResult {
        if (this.kind === "inbox") return { valid: true };

        if (this.kind === "event") {
            if (!isValidLocalDate(this.eventDate)) return invalid("Event date is invalid.");
            if (!this.eventAllDay) {
                if (!isValidLocalTime(this.eventStartTime)) return invalid("Event start time is invalid.");
                if (!isValidLocalTime(this.eventEndTime)) return invalid("Event end time is invalid.");
                if (
                    this.parseDateTime(this.eventDate, this.eventEndTime) <=
                    this.parseDateTime(this.eventDate, this.eventStartTime)
                ) {
                    return invalid("Event end must be later than start.");
                }
            }
            if (this.eventActualTimeEnabled && this.eventStatus !== "completed") {
                return invalid(
                    this.eventStatus === "cancelled"
                        ? "Cancelled Events cannot include actual time."
                        : "Actual time requires a completed Event.",
                );
            }
            if (this.eventActualTimeEnabled) {
                if (!isValidLocalDate(this.eventActualStartDate) || !isValidLocalTime(this.eventActualStartTime)) {
                    return invalid("Event actual start is invalid.");
                }
                if (!isValidLocalDate(this.eventActualEndDate) || !isValidLocalTime(this.eventActualEndTime)) {
                    return invalid("Event actual end is invalid.");
                }
                if (
                    this.parseDateTime(this.eventActualEndDate, this.eventActualEndTime) <=
                    this.parseDateTime(this.eventActualStartDate, this.eventActualStartTime)
                ) {
                    return invalid("Event actual end must be later than actual start.");
                }
            }
            return { valid: true };
        }

        if (this.taskDueDate) {
            if (!isValidLocalDate(this.taskDueDate)) return invalid("Task due date is invalid.");
            if (this.taskDueHasTime && !isValidLocalTime(this.taskDueTime)) {
                return invalid("Task due time is invalid.");
            }
        }

        if (this.taskTimeboxEnabled) {
            if (!isValidLocalDate(this.taskTimeboxDate)) return invalid("Task timebox date is invalid.");
            if (!isValidLocalTime(this.taskTimeboxStartTime)) return invalid("Task timebox start is invalid.");
            if (!isValidLocalTime(this.taskTimeboxEndTime)) return invalid("Task timebox end is invalid.");
            const start = this.parseDateTime(this.taskTimeboxDate, this.taskTimeboxStartTime);
            const end = this.parseDateTime(this.taskTimeboxDate, this.taskTimeboxEndTime);
            if (end <= start) return invalid("Task timebox end must be later than start.");
        }

        for (const reminder of this.reminders) {
            if (!reminder.date) continue;
            if (!isValidLocalDate(reminder.date)) return invalid("Reminder date is invalid.");
            if (!isValidLocalTime(reminder.time || "09:00")) return invalid("Reminder time is invalid.");
        }

        return { valid: true };
    }

    private parseDateTime(date: string, time: string): Date {
        if (!isValidLocalDate(date) || !isValidLocalTime(time)) {
            throw new Error(`Invalid local date-time: ${date} ${time}`);
        }
        return new Date(`${date}T${time}:00`);
    }
}

function invalid(message: string): TemporalValidationResult {
    return { valid: false, message };
}

function isValidLocalTime(value: string): boolean {
    return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isValidLocalDate(value: string): boolean {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}
