import type { TaskPriority } from "./ScheduledItemTypes";

export interface TaskLineEdit {
    completed: boolean;
    priority: TaskPriority;
    due: string | null;
    timebox: { start: string; end: string } | null;
    reminders: string[];
}

export type EditTaskLineResult = { status: "ready"; line: string } | { status: "invalid"; reason: "not-task" };

type OwnedKey = "priority" | "due" | "start" | "end" | "remind";

const OWNED_KEYS: OwnedKey[] = ["priority", "due", "start", "end", "remind"];

function metadataKey(segment: string): string | null {
    const separator = segment.indexOf(":");
    return separator === -1 ? null : segment.slice(0, separator).trim().toLowerCase();
}

function metadataValue(segment: string): string {
    const separator = segment.indexOf(":");
    return separator === -1 ? "" : segment.slice(separator + 1).trim();
}

function desiredMetadata(edit: TaskLineEdit): Record<OwnedKey, string[]> {
    return {
        priority: edit.priority === "normal" ? [] : [edit.priority],
        due: edit.due ? [edit.due] : [],
        start: edit.timebox ? [edit.timebox.start] : [],
        end: edit.timebox ? [edit.timebox.end] : [],
        remind: [...edit.reminders],
    };
}

export function editTaskLine(line: string, edit: TaskLineEdit): EditTaskLineResult {
    const match = line.match(/^(\s*-\s+\[)( |x|X)(\]\s+)(.+)$/);
    if (!match) return { status: "invalid", reason: "not-task" };

    const segments = match[4].split(" | ");
    const title = segments.shift() ?? "";
    const desired = desiredMetadata(edit);
    const consumed: Record<OwnedKey, number> = { priority: 0, due: 0, start: 0, end: 0, remind: 0 };
    const metadata: string[] = [];

    for (const segment of segments) {
        const key = metadataKey(segment);
        if (!key || !OWNED_KEYS.includes(key as OwnedKey)) {
            metadata.push(segment);
            continue;
        }

        const ownedKey = key as OwnedKey;
        const index = consumed[ownedKey];
        const value = desired[ownedKey][index];
        consumed[ownedKey] += 1;
        if (value === undefined) {
            if (
                ownedKey === "priority" &&
                edit.priority === "normal" &&
                metadataValue(segment).toLowerCase() === "normal"
            ) {
                metadata.push(segment);
            }
            continue;
        }

        const currentValue = metadataValue(segment);
        const unchanged = ownedKey === "priority" ? currentValue.toLowerCase() === value : currentValue === value;
        metadata.push(unchanged ? segment : `${ownedKey}:${value}`);
    }

    for (const key of OWNED_KEYS) {
        for (const value of desired[key].slice(consumed[key])) metadata.push(`${key}:${value}`);
    }

    const checkbox = edit.completed ? "x" : " ";
    const originalCheckboxMatches = (match[2].toLowerCase() === "x") === edit.completed;
    const checkboxValue = originalCheckboxMatches ? match[2] : checkbox;
    const payload = [title, ...metadata].join(" | ");
    return { status: "ready", line: `${match[1]}${checkboxValue}${match[3]}${payload}` };
}
