import { type App, Setting } from "obsidian";
import { buildDesktopScheduledItemFormModel } from "./DesktopScheduledItemFormModel.ts";
import { ContextNotesController } from "./InboxNotesController";
import { ObjectNoteSuggest } from "./ObjectNoteSuggest.ts";
import { parseObjectReferences } from "./ObjectReference.ts";
import type { ScheduledItemFormData } from "./ScheduledItemFormData";
import { FileSuggest, FolderSuggest } from "./Suggesters";
import type { ContextSourceSettings, InsertPosition } from "./types";

export interface DesktopScheduledItemCreateContext {
    targetFile: string;
    targetHeading: string;
    targetPosition: InsertPosition;
}

export interface DesktopScheduledItemFormOptions {
    app: App;
    mode: "create" | "edit";
    data: ScheduledItemFormData;
    contextLabel: string;
    targetFile: string;
    createContext?: DesktopScheduledItemCreateContext;
    defaultDetailNotesFolder?: string;
    getContextSources(): ContextSourceSettings[];
    /** Object Sources allowed as Task "Save to" destinations. Only consulted when data.kind === "task". */
    getAllowedTaskSources?(): ContextSourceSettings[];
    onChange(data: ScheduledItemFormData): void;
    onSubmit(): void;
    onCancel(): void;
    /** Switch the capture kind without requiring the user to close and reopen the form. Create mode only. */
    onSwitchKind?(kind: "inbox" | "event" | "task"): void;
}

export class DesktopScheduledItemForm {
    private container: HTMLElement | null = null;
    private descriptionController: ContextNotesController | null = null;
    private busy = false;
    private recovery = false;
    private errorMessage = "";

    constructor(private readonly options: DesktopScheduledItemFormOptions) {}

    render(container: HTMLElement): void {
        this.destroyController();
        // contentEl doesn't scroll itself — the ancestor `.modal` element does — so the
        // scroll position has to be read from and restored onto that ancestor instead.
        const scrollHost = container.closest<HTMLElement>(".modal") ?? container;
        const scrollTop = scrollHost.scrollTop;
        this.container = container;
        container.empty();
        container.addClass("fn-scheduled-item-desktop-form");
        const model = buildDesktopScheduledItemFormModel({
            mode: this.options.mode,
            data: this.options.data,
            contextLabel: this.options.contextLabel,
            busy: this.busy,
            recovery: this.recovery,
        });

        const header = container.createDiv({ cls: "fn-scheduled-item-form-header" });
        header.createEl("h2", { text: model.heading });
        header.createDiv({ cls: "fn-scheduled-item-form-context", text: model.contextLabel });
        this.renderKindChips(container);
        this.renderIdentity(container);
        if (this.options.data.kind === "task") this.renderTask(container);
        else this.renderEvent(container);
        this.renderDescription(container);
        this.renderDetail(container);
        if (this.options.mode === "create" && this.options.createContext) this.renderCreateContext(container);
        container.createDiv({
            cls: `fn-scheduled-item-form-error${this.errorMessage ? "" : " fn-gcal-hidden"}`,
            text: this.errorMessage,
            attr: { role: "alert", "aria-live": "polite" },
        });

        const actions = container.createDiv({ cls: "fn-timeline-modal-actions" });
        actions
            .createEl("button", { text: "Cancel", attr: { type: "button" } })
            .addEventListener("click", this.options.onCancel);
        const submit = actions.createEl("button", {
            cls: "mod-cta",
            text: model.submitLabel,
            attr: { type: "button", "aria-busy": model.ariaBusy },
        });
        submit.disabled = model.submitDisabled;
        submit.addEventListener("click", this.options.onSubmit);
        if (this.busy || this.recovery) this.lockFields(container, actions);
        scrollHost.scrollTop = scrollTop;
    }

    setSubmissionState(state: { busy: boolean; recovery: boolean; errorMessage?: string }): void {
        this.busy = state.busy;
        this.recovery = state.recovery;
        this.errorMessage = state.errorMessage ?? "";
        if (this.container) this.render(this.container);
    }

    destroy(): void {
        this.destroyController();
        this.container = null;
    }

    private renderKindChips(container: HTMLElement): void {
        const onSwitchKind = this.options.onSwitchKind;
        if (this.options.mode !== "create" || !onSwitchKind) return;
        const currentKind = this.options.data.kind;
        const tabs = container.createDiv({ cls: "fn-gcal-tabs" });
        const chips: Array<{ value: "inbox" | "event" | "task"; label: string }> = [
            { value: "inbox", label: "Moment" },
            { value: "event", label: "Event" },
            { value: "task", label: "Task" },
        ];
        for (const chip of chips) {
            const active = chip.value === currentKind;
            const button = tabs.createEl("button", {
                cls: `fn-gcal-tab${active ? " fn-gcal-tab--active" : ""}`,
                text: chip.label,
                attr: { type: "button", "aria-pressed": String(active) },
            });
            button.addEventListener("click", () => onSwitchKind(chip.value));
        }
    }

    private renderIdentity(container: HTMLElement): void {
        const title = new Setting(container)
            .setName("Title")
            .setDesc("The portable Task or Event title.")
            .setClass("fn-scheduled-item-form-wide-field");
        title.addText((text) =>
            text
                .setPlaceholder("Add title")
                .setValue(this.options.data.title)
                .onChange((value) => this.update(() => (this.options.data.title = value))),
        );
    }

    private renderTask(container: HTMLElement): void {
        const data = this.options.data;
        if (data.kind !== "task") return;
        if (this.options.mode === "edit") {
            new Setting(container)
                .setName("Completed")
                .addToggle((toggle) =>
                    toggle.setValue(data.completed).onChange((value) => this.update(() => (data.completed = value))),
                );
        }
        new Setting(container).setName("Priority").addDropdown((dropdown) =>
            dropdown
                .addOptions({ normal: "Normal", low: "Low", medium: "Medium", high: "High" })
                .setValue(data.priority)
                .onChange((value) => this.update(() => (data.priority = value as typeof data.priority))),
        );
        this.dateTimeSetting(container, "Due", data.due, false, (value) => (data.due = value));
        new Setting(container).setName("Timebox").addToggle((toggle) =>
            toggle.setValue(data.timebox !== null).onChange((enabled) => {
                data.timebox = enabled
                    ? { start: data.due?.includes(" ") ? data.due : "", end: data.due?.includes(" ") ? data.due : "" }
                    : null;
                this.changedAndRender();
            }),
        );
        if (data.timebox) {
            this.dateTimeSetting(container, "Timebox start", data.timebox.start, true, (value) => {
                if (data.timebox) data.timebox.start = value ?? "";
            });
            this.dateTimeSetting(container, "Timebox end", data.timebox.end, true, (value) => {
                if (data.timebox) data.timebox.end = value ?? "";
            });
        }
        new Setting(container).setName("Reminders").addButton((button) =>
            button.setButtonText("Add reminder").onClick(() => {
                data.reminders.push(data.due?.includes(" ") ? data.due : "");
                this.changedAndRender();
            }),
        );
        data.reminders.forEach((reminder, index) => {
            const row = this.dateTimeSetting(container, `Reminder ${index + 1}`, reminder, true, (value) => {
                data.reminders[index] = value ?? "";
            });
            row.addButton((button) =>
                button
                    .setIcon("trash")
                    .setTooltip(`Remove reminder ${index + 1}`)
                    .onClick(() => {
                        data.reminders.splice(index, 1);
                        this.changedAndRender();
                    }),
            );
        });
    }

    private renderEvent(container: HTMLElement): void {
        const data = this.options.data;
        if (data.kind !== "event") return;
        new Setting(container).setName("All day").addToggle((toggle) =>
            toggle.setValue(data.allDay).onChange((value) => {
                data.allDay = value;
                data.start = value ? data.start.slice(0, 10) : `${data.start.slice(0, 10)} 09:00`;
                data.end = value ? null : `${data.start.slice(0, 10)} 10:00`;
                this.changedAndRender();
            }),
        );
        this.dateTimeSetting(
            container,
            "Planned start",
            data.start,
            !data.allDay,
            (value) => (data.start = value ?? ""),
        );
        if (!data.allDay) {
            this.dateTimeSetting(container, "Planned end", data.end, true, (value) => (data.end = value));
        }
        new Setting(container).setName("Status").addDropdown((dropdown) =>
            dropdown
                .addOptions({ planned: "Planned", completed: "Completed", cancelled: "Cancelled" })
                .setValue(data.status)
                .onChange((value) => {
                    data.status = value as typeof data.status;
                    if (data.status !== "completed") data.actual = null;
                    this.changedAndRender();
                }),
        );
        if (data.status === "completed") {
            new Setting(container).setName("Record actual time").addToggle((toggle) =>
                toggle.setValue(data.actual !== null).onChange((enabled) => {
                    data.actual = enabled
                        ? { start: timedValue(data.start), end: timedValue(data.end ?? data.start) }
                        : null;
                    this.changedAndRender();
                }),
            );
            if (data.actual) {
                this.dateTimeSetting(container, "Actual start", data.actual.start, true, (value) => {
                    if (data.actual) data.actual.start = value ?? "";
                });
                this.dateTimeSetting(container, "Actual end", data.actual.end, true, (value) => {
                    if (data.actual) data.actual.end = value ?? "";
                });
            }
        }
    }

    private renderDescription(container: HTMLElement): void {
        const setting = new Setting(container)
            .setName("Description")
            .setDesc("Use @ for Object Notes, Tasks, or Events; @task and @event search stable block links.")
            .setClass("fn-scheduled-item-form-wide-field");
        const editor = setting.controlEl.createDiv({
            cls: "fn-gcal-desc-input",
            attr: { role: "textbox", "aria-label": "Description", "aria-multiline": "true" },
        });
        this.descriptionController = new ContextNotesController(this.options.app, editor, {
            initialValue: this.options.data.description,
            targetFile: this.options.targetFile,
            getContextSources: this.options.getContextSources,
            referenceFormat: "markdown-link",
            onChange: (value) => {
                this.options.data.description = value;
                this.options.data.objectReferences = parseObjectReferences(value).map(
                    (occurrence) => occurrence.reference,
                );
                this.options.onChange(this.options.data);
            },
        });
    }

    private renderDetail(container: HTMLElement): void {
        const data = this.options.data;
        new Setting(container).setName("Detail Note").addDropdown((dropdown) =>
            dropdown
                .addOptions({ none: "None", link: "Link existing", create: "Create new" })
                .setValue(data.detailNote.mode)
                .onChange((mode) => {
                    data.detailNote =
                        mode === "link"
                            ? { mode: "link", path: "" }
                            : mode === "create"
                              ? {
                                    mode: "create",
                                    name: data.title,
                                    folder: this.options.defaultDetailNotesFolder ?? "",
                                }
                              : { mode: "none" };
                    this.changedAndRender();
                }),
        );
        if (data.detailNote.mode === "link") {
            const setting = new Setting(container)
                .setName("Existing note")
                .setClass("fn-scheduled-item-form-wide-field");
            const input = setting.controlEl.createEl("input", {
                type: "text",
                attr: { "aria-label": "Existing Detail Note" },
            });
            input.value = data.detailNote.path;
            input.addEventListener("input", () =>
                this.update(() => {
                    if (data.detailNote.mode === "link") data.detailNote.path = input.value;
                }),
            );
            new FileSuggest(this.options.app, input);
        }
        if (data.detailNote.mode === "create") {
            new Setting(container)
                .setName("Note name")
                .setClass("fn-scheduled-item-form-wide-field")
                .addText((text) =>
                    text.setValue(data.detailNote.mode === "create" ? data.detailNote.name : "").onChange((value) =>
                        this.update(() => {
                            if (data.detailNote.mode === "create") data.detailNote.name = value;
                        }),
                    ),
                );
            const setting = new Setting(container).setName("Folder").setClass("fn-scheduled-item-form-wide-field");
            const input = setting.controlEl.createEl("input", {
                type: "text",
                attr: { "aria-label": "Detail Note folder" },
            });
            input.value = data.detailNote.folder;
            input.addEventListener("input", () =>
                this.update(() => {
                    if (data.detailNote.mode === "create") data.detailNote.folder = input.value;
                }),
            );
            new FolderSuggest(this.options.app, input);
        }
    }

    private renderCreateContext(container: HTMLElement): void {
        const context = this.options.createContext;
        if (!context) return;
        const fileSetting = new Setting(container).setName("Save to file");
        const file = fileSetting.controlEl.createEl("input", {
            type: "text",
            attr: { "aria-label": "Save to file", placeholder: "Daily/2026-08-28.md" },
        });
        file.value = context.targetFile;
        file.addEventListener("input", () => {
            context.targetFile = file.value;
            this.descriptionController?.setTargetFile(file.value);
        });
        if (this.options.data.kind === "task") {
            new ObjectNoteSuggest(this.options.app, file, () => this.options.getAllowedTaskSources?.() ?? []);
        } else {
            new FileSuggest(this.options.app, file);
        }
        new Setting(container).setName("Heading").addText((text) =>
            text.setValue(context.targetHeading).onChange((value) => {
                context.targetHeading = value;
            }),
        );
        new Setting(container).setName("Insert at top").addToggle((toggle) =>
            toggle.setValue(context.targetPosition === "start").onChange((enabled) => {
                context.targetPosition = enabled ? "start" : "end";
            }),
        );
    }

    private dateTimeSetting(
        container: HTMLElement,
        label: string,
        value: string | null,
        requireTime: boolean,
        onChange: (value: string | null) => void,
    ): Setting {
        const [dateValue = "", timeValue = ""] = value?.split(" ") ?? [];
        const setting = new Setting(container).setName(label);
        const date = setting.controlEl.createEl("input", { type: "date", attr: { "aria-label": `${label} date` } });
        date.value = dateValue;
        let time: HTMLInputElement | null = null;
        if (requireTime || timeValue) {
            time = setting.controlEl.createEl("input", { type: "time", attr: { "aria-label": `${label} time` } });
            time.value = timeValue;
        }
        const emit = (): void =>
            this.update(() => onChange(date.value ? `${date.value}${time?.value ? ` ${time.value}` : ""}` : null));
        date.addEventListener("change", emit);
        time?.addEventListener("change", emit);
        return setting;
    }

    private update(change: () => void): void {
        change();
        this.options.onChange(this.options.data);
    }

    private changedAndRender(): void {
        this.options.onChange(this.options.data);
        if (this.container) this.render(this.container);
    }

    private destroyController(): void {
        this.descriptionController?.destroy();
        this.descriptionController = null;
    }

    private lockFields(container: HTMLElement, actions: HTMLElement): void {
        container
            .querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>("input, select, button")
            .forEach((control) => {
                if (!actions.contains(control)) control.disabled = true;
            });
        container.querySelectorAll<HTMLElement>("[contenteditable]").forEach((editor) => {
            editor.contentEditable = "false";
            editor.setAttribute("aria-disabled", "true");
        });
    }
}

function timedValue(value: string): string {
    return value.includes(" ") ? value : `${value} 09:00`;
}
