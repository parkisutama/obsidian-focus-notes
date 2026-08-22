import { type App, Component, Setting, setIcon } from "obsidian";
import { ContextNotesController } from "./InboxNotesController.ts";
import { buildMobileScheduledItemFormModel } from "./MobileScheduledItemFormModel.ts";
import { getMobileViewportMetrics } from "./MobileViewport.ts";
import { ObjectNoteSuggest } from "./ObjectNoteSuggest.ts";
import { parseObjectReferences } from "./ObjectReference.ts";
import type { ScheduledItemFormData } from "./ScheduledItemFormData.ts";
import { FileSuggest, FolderSuggest } from "./Suggesters.ts";
import type { ContextSourceSettings, InsertPosition } from "./types.ts";

export interface MobileScheduledItemCreateContext {
    targetFile: string;
    targetHeading: string;
    targetPosition: InsertPosition;
}

export interface MobileScheduledItemFormOptions {
    app: App;
    mode: "create" | "edit";
    data: ScheduledItemFormData;
    contextLabel: string;
    targetFile: string;
    createContext?: MobileScheduledItemCreateContext;
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

export class MobileScheduledItemForm extends Component {
    private rootEl: HTMLElement | null = null;
    private controller: ContextNotesController | null = null;
    private busy = false;
    private recovery = false;
    private errorMessage = "";

    constructor(private readonly options: MobileScheduledItemFormOptions) {
        super();
    }

    open(owner?: Component): void {
        if (this.rootEl) return;
        this.rootEl = this.options.app.workspace.containerEl.createDiv({
            cls: "fn-mobile-event-screen fn-mobile-scheduled-item-form",
            attr: { role: "dialog", "aria-modal": "true" },
        });
        document.body.addClass("fn-mobile-event-screen-open");
        this.render();
        this.registerViewportLifecycle();
        if (owner) owner.addChild(this);
        else this.load();
    }

    close(): void {
        this.options.onCancel();
    }

    onunload(): void {
        this.controller?.destroy();
        this.controller = null;
        this.rootEl?.remove();
        this.rootEl = null;
        document.body.removeClass("fn-mobile-event-screen-open");
    }

    setSubmissionState(state: { busy: boolean; recovery: boolean; errorMessage?: string }): void {
        this.busy = state.busy;
        this.recovery = state.recovery;
        this.errorMessage = state.errorMessage ?? "";
        this.render();
    }

    private render(): void {
        const root = this.rootEl;
        if (!root) return;
        this.controller?.destroy();
        this.controller = null;
        root.empty();
        const model = buildMobileScheduledItemFormModel({
            mode: this.options.mode,
            data: this.options.data,
            contextLabel: this.options.contextLabel,
            busy: this.busy,
            recovery: this.recovery,
        });
        root.setAttribute("aria-label", model.heading);
        root.createDiv({ cls: "fn-mobile-event-handle", attr: { "aria-hidden": "true" } });
        const header = root.createEl("header", { cls: "fn-mobile-event-header" });
        const cancel = header.createEl("button", {
            cls: "fn-mobile-event-cancel",
            attr: { type: "button", "aria-label": "Cancel" },
        });
        setIcon(cancel, "x");
        cancel.addEventListener("click", this.options.onCancel);
        header.createDiv({ cls: "fn-mobile-scheduled-title", text: model.heading });
        const submit = header.createEl("button", {
            cls: "fn-mobile-event-save mod-cta",
            text: model.submitLabel,
            attr: { type: "button", "aria-busy": model.ariaBusy },
        });
        submit.disabled = model.submitDisabled;
        submit.addEventListener("click", this.options.onSubmit);

        const body = root.createEl("main", { cls: "fn-mobile-event-body" });
        body.createDiv({ cls: "fn-mobile-scheduled-context", text: model.contextLabel });
        this.renderKindChips(body);
        this.text(body, "Title", this.options.data.title, (value) => (this.options.data.title = value));
        if (this.options.data.kind === "task") this.renderTask(body);
        else this.renderEvent(body);
        this.renderDescription(body);
        this.renderDetail(body);
        if (model.showCreateTarget && this.options.createContext) this.renderTarget(body);
        body.createDiv({
            cls: `fn-scheduled-item-form-error${this.errorMessage ? "" : " fn-gcal-hidden"}`,
            text: this.errorMessage,
            attr: { role: "alert", "aria-live": "polite" },
        });
        if (model.fieldsDisabled) this.lockFields(body);
    }

    private renderKindChips(body: HTMLElement): void {
        const onSwitchKind = this.options.onSwitchKind;
        if (this.options.mode !== "create" || !onSwitchKind) return;
        const currentKind = this.options.data.kind;
        const group = body.createDiv({
            cls: "fn-mobile-event-kind",
            attr: { role: "group", "aria-label": "Item type" },
        });
        const chips: Array<{ value: "inbox" | "event" | "task"; label: string }> = [
            { value: "inbox", label: "Moment" },
            { value: "event", label: "Event" },
            { value: "task", label: "Task" },
        ];
        for (const chip of chips) {
            const active = chip.value === currentKind;
            const button = group.createEl("button", {
                cls: `fn-mobile-event-kind-button${active ? " is-active" : ""}`,
                text: chip.label,
                attr: { type: "button", "aria-pressed": String(active) },
            });
            button.addEventListener("click", () => onSwitchKind(chip.value));
        }
    }

    private renderTask(body: HTMLElement): void {
        const data = this.options.data;
        if (data.kind !== "task") return;
        if (this.options.mode === "edit")
            this.toggle(body, "Completed", data.completed, (value) => (data.completed = value));
        new Setting(body).setName("Priority").addDropdown((dropdown) =>
            dropdown
                .addOptions({ normal: "Normal", low: "Low", medium: "Medium", high: "High" })
                .setValue(data.priority)
                .onChange((value) => this.changed(() => (data.priority = value as typeof data.priority))),
        );
        this.dateTime(body, "Due", data.due, false, (value) => (data.due = value));
        new Setting(body).setName("Timebox").addToggle((toggle) =>
            toggle.setValue(data.timebox !== null).onChange((enabled) => {
                data.timebox = enabled
                    ? { start: data.due?.includes(" ") ? data.due : "", end: data.due?.includes(" ") ? data.due : "" }
                    : null;
                this.rerender();
            }),
        );
        if (data.timebox) {
            this.dateTime(body, "Timebox start", data.timebox.start, true, (value) => {
                if (data.timebox) data.timebox.start = value ?? "";
            });
            this.dateTime(body, "Timebox end", data.timebox.end, true, (value) => {
                if (data.timebox) data.timebox.end = value ?? "";
            });
        }
        new Setting(body).setName("Reminders").addButton((button) =>
            button.setButtonText("Add reminder").onClick(() => {
                data.reminders.push(data.due?.includes(" ") ? data.due : "");
                this.rerender();
            }),
        );
        data.reminders.forEach((reminder, index) => {
            const row = this.dateTime(body, `Reminder ${index + 1}`, reminder, true, (value) => {
                data.reminders[index] = value ?? "";
            });
            row.addButton((button) =>
                button
                    .setIcon("trash")
                    .setTooltip(`Remove reminder ${index + 1}`)
                    .onClick(() => {
                        data.reminders.splice(index, 1);
                        this.rerender();
                    }),
            );
        });
    }

    private renderEvent(body: HTMLElement): void {
        const data = this.options.data;
        if (data.kind !== "event") return;
        this.toggle(body, "All day", data.allDay, (value) => {
            data.allDay = value;
            data.start = value ? data.start.slice(0, 10) : `${data.start.slice(0, 10)} 09:00`;
            data.end = value ? null : `${data.start.slice(0, 10)} 10:00`;
            this.rerender();
        });
        this.dateTime(body, "Planned start", data.start, !data.allDay, (value) => (data.start = value ?? ""));
        if (!data.allDay) this.dateTime(body, "Planned end", data.end, true, (value) => (data.end = value));
        new Setting(body).setName("Status").addDropdown((dropdown) =>
            dropdown
                .addOptions({ planned: "Planned", completed: "Completed", cancelled: "Cancelled" })
                .setValue(data.status)
                .onChange((value) => {
                    data.status = value as typeof data.status;
                    if (data.status !== "completed") data.actual = null;
                    this.rerender();
                }),
        );
        if (data.status === "completed") {
            this.toggle(body, "Record actual time", data.actual !== null, (enabled) => {
                data.actual = enabled
                    ? { start: timedValue(data.start), end: timedValue(data.end ?? data.start) }
                    : null;
                this.rerender();
            });
            if (data.actual) {
                this.dateTime(body, "Actual start", data.actual.start, true, (value) => {
                    if (data.actual) data.actual.start = value ?? "";
                });
                this.dateTime(body, "Actual end", data.actual.end, true, (value) => {
                    if (data.actual) data.actual.end = value ?? "";
                });
            }
        }
    }

    private renderDescription(body: HTMLElement): void {
        const setting = new Setting(body)
            .setName("Description")
            .setDesc("Use @ for Object Notes, Tasks, or Events; @task and @event search stable block links.");
        const editor = setting.controlEl.createDiv({
            cls: "fn-mobile-event-description",
            attr: { role: "textbox", "aria-label": "Description", "aria-multiline": "true" },
        });
        this.controller = new ContextNotesController(this.options.app, editor, {
            initialValue: this.options.data.description,
            targetFile: this.options.targetFile,
            getContextSources: this.options.getContextSources,
            referenceFormat: "markdown-link",
            onChange: (value) => {
                this.options.data.description = value;
                this.options.data.objectReferences = parseObjectReferences(value).map((item) => item.reference);
                this.options.onChange(this.options.data);
            },
        });
    }

    private renderDetail(body: HTMLElement): void {
        const data = this.options.data;
        new Setting(body).setName("Detail Note").addDropdown((dropdown) =>
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
                    this.rerender();
                }),
        );
        if (data.detailNote.mode === "link") {
            const setting = this.text(body, "Detail Note path", data.detailNote.path, (value) => {
                if (data.detailNote.mode === "link") data.detailNote.path = value;
            });
            this.registerSuggester(new FileSuggest(this.options.app, setting));
        }
        if (data.detailNote.mode === "create") {
            this.text(body, "Detail Note name", data.detailNote.name, (value) => {
                if (data.detailNote.mode === "create") data.detailNote.name = value;
            });
            const folder = this.text(body, "Detail Note folder", data.detailNote.folder, (value) => {
                if (data.detailNote.mode === "create") data.detailNote.folder = value;
            });
            this.registerSuggester(new FolderSuggest(this.options.app, folder));
        }
    }

    private renderTarget(body: HTMLElement): void {
        const context = this.options.createContext;
        if (!context) return;
        const file = this.text(body, "Save to file", context.targetFile, (value) => {
            context.targetFile = value;
            this.controller?.setTargetFile(value);
        });
        if (this.options.data.kind === "task") {
            this.registerSuggester(
                new ObjectNoteSuggest(this.options.app, file, () => this.options.getAllowedTaskSources?.() ?? []),
            );
        } else {
            this.registerSuggester(new FileSuggest(this.options.app, file));
        }
        this.text(body, "Save under heading", context.targetHeading, (value) => (context.targetHeading = value));
        this.toggle(
            body,
            "Insert at top",
            context.targetPosition === "start",
            (value) => (context.targetPosition = value ? "start" : "end"),
        );
    }

    private dateTime(
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
            this.changed(() => onChange(date.value ? `${date.value}${time?.value ? ` ${time.value}` : ""}` : null));
        date.addEventListener("change", emit);
        time?.addEventListener("change", emit);
        return setting;
    }

    private text(
        container: HTMLElement,
        label: string,
        value: string,
        onChange: (value: string) => void,
        placeholder = "",
    ): HTMLInputElement {
        let input!: HTMLInputElement;
        new Setting(container).setName(label).addText((control) => {
            control
                .setValue(value)
                .setPlaceholder(placeholder)
                .onChange((next) => this.changed(() => onChange(next)));
            input = control.inputEl;
        });
        return input;
    }

    private toggle(container: HTMLElement, label: string, value: boolean, onChange: (value: boolean) => void): void {
        new Setting(container)
            .setName(label)
            .addToggle((toggle) => toggle.setValue(value).onChange((next) => this.changed(() => onChange(next))));
    }

    private changed(change: () => void): void {
        change();
        this.options.onChange(this.options.data);
    }

    private rerender(): void {
        this.options.onChange(this.options.data);
        this.render();
    }

    private lockFields(body: HTMLElement): void {
        body.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>(
            "input, select, button",
        ).forEach((element) => {
            element.disabled = true;
        });
        body.querySelectorAll<HTMLElement>("[contenteditable]").forEach((element) => {
            element.contentEditable = "false";
            element.setAttribute("aria-disabled", "true");
        });
    }

    private registerSuggester(suggester: { close(): void }): void {
        this.register(() => suggester.close());
    }

    private registerViewportLifecycle(): void {
        const root = this.rootEl;
        if (!root) return;
        const viewport = window.visualViewport;
        const update = (): void => {
            const top = this.options.app.workspace.containerEl.getBoundingClientRect().top;
            const metrics = getMobileViewportMetrics(window.innerHeight, viewport ?? undefined, top, 8);
            root.style.setProperty("--fn-mobile-screen-height", `${metrics.height}px`);
            root.style.setProperty("--fn-mobile-screen-top", `${metrics.offsetTop}px`);
        };
        const reveal = (): void => {
            const active = document.activeElement;
            if (active instanceof HTMLElement && root.contains(active))
                window.setTimeout(() => active.scrollIntoView({ block: "nearest" }), 50);
        };
        update();
        this.registerDomEvent(window, "resize", update);
        this.registerDomEvent(window, "keydown", (event) => {
            if (event.key === "Escape") this.options.onCancel();
        });
        this.registerDomEvent(root, "focusin", reveal);
        if (viewport) {
            viewport.addEventListener("resize", update);
            viewport.addEventListener("scroll", update);
            // focusin fires before the on-screen keyboard finishes opening, so the initial
            // reveal() scrolls against pre-keyboard viewport bounds. Re-run it once the
            // keyboard's actual size lands via visualViewport's own resize event.
            viewport.addEventListener("resize", reveal);
            this.register(() => {
                viewport.removeEventListener("resize", update);
                viewport.removeEventListener("scroll", update);
                viewport.removeEventListener("resize", reveal);
            });
        }
    }
}

function timedValue(value: string): string {
    return value.includes(" ") ? value : `${value} 09:00`;
}
