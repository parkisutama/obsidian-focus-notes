export type EventTaskKind = "inbox" | "event" | "task";

export interface OpenEventTaskFormOptions {
    initialKind?: EventTaskKind;
    targetFile?: string;
}
