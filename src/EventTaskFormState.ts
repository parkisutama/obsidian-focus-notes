import type { EventTaskRecord, HubNoteRef, TaskRecord } from "./EventTaskWriter";
import type { InboxSettings, InsertPosition } from "./types";

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
    inboxPeopleFoldersOverride: string[] = [];
    inboxPlaceFoldersOverride: string[] = [];

    eventDate: string;
    eventStartTime: string;
    eventEndTime: string;
    eventAllDay = false;

    taskDueDate: string;
    taskDueTime = "09:00";
    taskDueHasTime = false;
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
            peopleFolders: ["People"],
            placeFolders: ["Place"],
        };
        this.inboxCapturedAt = new Date(anchorDate.getTime());
        this.inboxDefaultTitle = formatLocalDateTime(this.inboxCapturedAt);
        this.inboxTitle = this.inboxDefaultTitle;
        this.inboxTargetFile = defaults.inboxTargetFile ?? "";
        this.inboxHeading = inboxDefaults.heading;
        this.inboxPosition = inboxDefaults.position;

        const hour = anchorDate.getHours();
        const endHour = Math.min(hour + 1, 23);
        this.eventDate = formatLocalDate(anchorDate);
        this.eventStartTime = `${String(hour).padStart(2, "0")}:00`;
        this.eventEndTime = `${String(endHour).padStart(2, "0")}:00`;
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
            return {
                kind: "event",
                title: this.title.trim(),
                start: this.parseDateTime(this.eventDate, this.eventStartTime),
                end: this.parseDateTime(this.eventDate, this.eventEndTime),
                allDay: this.eventAllDay,
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

    private parseDateTime(date: string, time: string): Date {
        const value = new Date(`${date}T${time || "00:00"}:00`);
        return Number.isNaN(value.getTime()) ? new Date() : value;
    }
}
