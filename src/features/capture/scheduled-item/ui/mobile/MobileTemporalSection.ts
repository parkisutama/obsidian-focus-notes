import { Setting } from "obsidian";
import type { ScheduledItemFormData } from "../../domain/ScheduledItemFormData.ts";
import type { MobileFormFields } from "./MobileFormFields.ts";

interface MobileTemporalSectionOptions {
    mode: "create" | "edit";
    data: ScheduledItemFormData;
    fields: MobileFormFields;
    changed(change: () => void): void;
    rerender(): void;
    /** Create-mode Event only: notified with the new Planned Start value so the target file can resync. */
    onEventStartChanged?(value: string): void;
}

export function renderMobileTemporalSection(body: HTMLElement, options: MobileTemporalSectionOptions): void {
    if (options.data.kind === "task") renderTask(body, options);
    else renderEvent(body, options);
}

function renderTask(body: HTMLElement, options: MobileTemporalSectionOptions): void {
    const data = options.data;
    if (data.kind !== "task") return;
    if (options.mode === "edit") {
        options.fields.toggle(body, "Completed", data.completed, (value) => (data.completed = value));
    }
    new Setting(body).setName("Priority").addDropdown((dropdown) =>
        dropdown
            .addOptions({ normal: "Normal", low: "Low", medium: "Medium", high: "High" })
            .setValue(data.priority)
            .onChange((value) => options.changed(() => (data.priority = value as typeof data.priority))),
    );
    options.fields.dateTime(body, "Due", data.due, false, (value) => (data.due = value));
    new Setting(body).setName("Timebox").addToggle((toggle) =>
        toggle.setValue(data.timebox !== null).onChange((enabled) => {
            data.timebox = enabled
                ? { start: data.due?.includes(" ") ? data.due : "", end: data.due?.includes(" ") ? data.due : "" }
                : null;
            options.rerender();
        }),
    );
    if (data.timebox) {
        options.fields.dateTime(body, "Timebox start", data.timebox.start, true, (value) => {
            if (data.timebox) data.timebox.start = value ?? "";
        });
        options.fields.dateTime(body, "Timebox end", data.timebox.end, true, (value) => {
            if (data.timebox) data.timebox.end = value ?? "";
        });
    }
    new Setting(body).setName("Reminders").addButton((button) =>
        button.setButtonText("Add reminder").onClick(() => {
            data.reminders.push(data.due?.includes(" ") ? data.due : "");
            options.rerender();
        }),
    );
    data.reminders.forEach((reminder, index) => {
        const row = options.fields.dateTime(body, `Reminder ${index + 1}`, reminder, true, (value) => {
            data.reminders[index] = value ?? "";
        });
        row.addButton((button) =>
            button
                .setIcon("trash")
                .setTooltip(`Remove reminder ${index + 1}`)
                .onClick(() => {
                    data.reminders.splice(index, 1);
                    options.rerender();
                }),
        );
    });
}

function renderEvent(body: HTMLElement, options: MobileTemporalSectionOptions): void {
    const data = options.data;
    if (data.kind !== "event") return;
    options.fields.toggle(body, "All day", data.allDay, (value) => {
        data.allDay = value;
        data.start = value ? data.start.slice(0, 10) : `${data.start.slice(0, 10)} 09:00`;
        data.end = value ? null : `${data.start.slice(0, 10)} 10:00`;
        options.rerender();
    });
    options.fields.dateTime(body, "Planned start", data.start, !data.allDay, (value) => {
        data.start = value ?? "";
        options.onEventStartChanged?.(data.start);
    });
    if (!data.allDay) {
        options.fields.dateTime(body, "Planned end", data.end, true, (value) => (data.end = value));
    }
    new Setting(body).setName("Status").addDropdown((dropdown) =>
        dropdown
            .addOptions({ planned: "Planned", completed: "Completed", cancelled: "Cancelled" })
            .setValue(data.status)
            .onChange((value) => {
                data.status = value as typeof data.status;
                if (data.status !== "completed") data.actual = null;
                options.rerender();
            }),
    );
    if (data.status !== "completed") return;
    options.fields.toggle(body, "Record actual time", data.actual !== null, (enabled) => {
        data.actual = enabled ? { start: timedValue(data.start), end: timedValue(data.end ?? data.start) } : null;
        options.rerender();
    });
    if (!data.actual) return;
    options.fields.dateTime(body, "Actual start", data.actual.start, true, (value) => {
        if (data.actual) data.actual.start = value ?? "";
    });
    options.fields.dateTime(body, "Actual end", data.actual.end, true, (value) => {
        if (data.actual) data.actual.end = value ?? "";
    });
}

function timedValue(value: string): string {
    return value.includes(" ") ? value : `${value} 09:00`;
}
