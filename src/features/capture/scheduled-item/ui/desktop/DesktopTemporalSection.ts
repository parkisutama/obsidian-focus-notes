import { Setting } from "obsidian";
import type { ScheduledItemFormData } from "../../domain/ScheduledItemFormData.ts";
import { parseCanonicalValue } from "../../domain/DateTimeFormat.ts";
import { DesktopDateTimePicker } from "./DesktopDateTimePicker.ts";

interface DesktopTemporalSectionOptions {
    mode: "create" | "edit";
    data: ScheduledItemFormData;
    update(change: () => void): void;
    changedAndRender(): void;
    /** Create-mode Event only: notified with the new Planned Start value so the target file can resync. */
    onEventStartChanged?(value: string): void;
    /** Edit-mode Task only: opens the Timebox Manager for this Task's saved canonical block. */
    onManageTimeboxes?(): void;
}

/** Returns every date/time picker this render created, so the caller can destroy them before the next render. */
export function renderDesktopTemporalSection(
    container: HTMLElement,
    options: DesktopTemporalSectionOptions,
): DesktopDateTimePicker[] {
    const pickers: DesktopDateTimePicker[] = [];
    if (options.data.kind === "task") renderTaskSection(container, options, pickers);
    else renderEventSection(container, options, pickers);
    return pickers;
}

function renderTaskSection(
    container: HTMLElement,
    options: DesktopTemporalSectionOptions,
    pickers: DesktopDateTimePicker[],
): void {
    const data = options.data;
    if (data.kind !== "task") return;
    if (options.mode === "edit") {
        new Setting(container)
            .setName("Completed")
            .addToggle((toggle) =>
                toggle.setValue(data.completed).onChange((value) => options.update(() => (data.completed = value))),
            );
    }
    new Setting(container).setName("Priority").addDropdown((dropdown) =>
        dropdown
            .addOptions({ normal: "Normal", low: "Low", medium: "Medium", high: "High" })
            .setValue(data.priority)
            .onChange((value) => options.update(() => (data.priority = value as typeof data.priority))),
    );
    dateTimeSetting(container, pickers, "Due", data.due, false, options.update, (value) => (data.due = value));
    new Setting(container).setName("Timebox").addToggle((toggle) =>
        toggle.setValue(data.timebox !== null).onChange((enabled) => {
            data.timebox = enabled
                ? { start: data.due?.includes(" ") ? data.due : "", end: data.due?.includes(" ") ? data.due : "" }
                : null;
            options.changedAndRender();
        }),
    );
    if (data.timebox) {
        dateTimeSetting(container, pickers, "Timebox start", data.timebox.start, true, options.update, (value) => {
            if (data.timebox) data.timebox.start = value ?? "";
        });
        dateTimeSetting(container, pickers, "Timebox end", data.timebox.end, true, options.update, (value) => {
            if (data.timebox) data.timebox.end = value ?? "";
        });
    }
    if (options.mode === "edit" && options.onManageTimeboxes) {
        new Setting(container)
            .setName("Timeboxes")
            .setDesc("Manage multiple planned work sessions for this Task.")
            .addButton((button) =>
                button.setButtonText("Manage timeboxes").onClick(() => options.onManageTimeboxes?.()),
            );
    }
    new Setting(container).setName("Reminders").addButton((button) =>
        button.setButtonText("Add reminder").onClick(() => {
            data.reminders.push(data.due?.includes(" ") ? data.due : "");
            options.changedAndRender();
        }),
    );
    data.reminders.forEach((reminder, index) => {
        const row = dateTimeSetting(
            container,
            pickers,
            `Reminder ${index + 1}`,
            reminder,
            true,
            options.update,
            (value) => {
                data.reminders[index] = value ?? "";
            },
        );
        row.addButton((button) =>
            button
                .setIcon("trash")
                .setTooltip(`Remove reminder ${index + 1}`)
                .onClick(() => {
                    data.reminders.splice(index, 1);
                    options.changedAndRender();
                }),
        );
    });
}

function renderEventSection(
    container: HTMLElement,
    options: DesktopTemporalSectionOptions,
    pickers: DesktopDateTimePicker[],
): void {
    const data = options.data;
    if (data.kind !== "event") return;
    new Setting(container).setName("All day").addToggle((toggle) =>
        toggle.setValue(data.allDay).onChange((value) => {
            data.allDay = value;
            data.start = value ? data.start.slice(0, 10) : `${data.start.slice(0, 10)} 09:00`;
            data.end = value ? null : `${data.start.slice(0, 10)} 10:00`;
            options.changedAndRender();
        }),
    );
    dateTimeSetting(container, pickers, "Planned start", data.start, !data.allDay, options.update, (value) => {
        data.start = value ?? "";
        options.onEventStartChanged?.(data.start);
    });
    if (!data.allDay) {
        dateTimeSetting(container, pickers, "Planned end", data.end, true, options.update, (value) => (data.end = value));
    }
    new Setting(container).setName("Status").addDropdown((dropdown) =>
        dropdown
            .addOptions({ planned: "Planned", completed: "Completed", cancelled: "Cancelled" })
            .setValue(data.status)
            .onChange((value) => {
                data.status = value as typeof data.status;
                if (data.status !== "completed") data.actual = null;
                options.changedAndRender();
            }),
    );
    if (data.status !== "completed") return;
    new Setting(container).setName("Record actual time").addToggle((toggle) =>
        toggle.setValue(data.actual !== null).onChange((enabled) => {
            data.actual = enabled ? { start: timedValue(data.start), end: timedValue(data.end ?? data.start) } : null;
            options.changedAndRender();
        }),
    );
    if (!data.actual) return;
    dateTimeSetting(container, pickers, "Actual start", data.actual.start, true, options.update, (value) => {
        if (data.actual) data.actual.start = value ?? "";
    });
    dateTimeSetting(container, pickers, "Actual end", data.actual.end, true, options.update, (value) => {
        if (data.actual) data.actual.end = value ?? "";
    });
}

function dateTimeSetting(
    container: HTMLElement,
    pickers: DesktopDateTimePicker[],
    label: string,
    value: string | null,
    requireTime: boolean,
    update: (change: () => void) => void,
    onChange: (value: string | null) => void,
): Setting {
    // A field that doesn't strictly require time (e.g. "Due") still shows the time row once its
    // existing value already carries one, matching the old native-input behavior exactly.
    const hasExistingTime = parseCanonicalValue(value)?.hour !== null && parseCanonicalValue(value)?.hour !== undefined;
    const setting = new Setting(container).setName(label);
    const picker = new DesktopDateTimePicker({
        initialValue: value,
        requireTime: requireTime || hasExistingTime,
        ariaLabel: label,
        onChange: (next) => update(() => onChange(next)),
    });
    picker.render(setting.controlEl);
    pickers.push(picker);
    return setting;
}

function timedValue(value: string): string {
    return value.includes(" ") ? value : `${value} 09:00`;
}
