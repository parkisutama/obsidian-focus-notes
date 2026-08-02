import {
    App,
    Component,
    FuzzySuggestModal,
    Notice,
    TFile,
    setIcon
} from "obsidian";
import { EventTaskFormState, EventTaskKind, HubMode, formatLocalDate } from "./EventTaskFormState";
import { submitEventTask, submitInbox } from "./EventTaskSubmission";
import { EventTaskRecord, EventTaskWriter } from "./EventTaskWriter";
import { getMobileViewportMetrics } from "./MobileViewport";
import { FileSuggest, FolderSuggest } from "./Suggesters";
import { TargetResolver } from "./TargetResolver";
import { FocusNotesSettings, FocusTarget } from "./types";
import { isTFile } from "./utils";
import { InboxMobileForm } from "./InboxMobileForm";
import { selectInboxTarget } from "./InboxTarget";

export class EventTaskMobileScreen extends Component {
    private rootEl: HTMLElement | null = null;
    private bodyEl: HTMLElement | null = null;
    private resolved = false;
    private submitting = false;
    private owner: Component | null = null;
    private readonly form: EventTaskFormState;

    constructor(
        private readonly app: App,
        private readonly getSettings: () => FocusNotesSettings,
        private readonly anchorDate: Date = new Date(),
        private readonly onComplete: () => void = () => {}
    ) {
        super();
        const settings = getSettings();
        const resolver = new TargetResolver(app, settings);
        const target = resolver.resolve(resolver.getActiveTarget(), anchorDate);
        this.form = new EventTaskFormState(anchorDate, {
            file: target.file,
            heading: settings.eventTask.defaultSaveHeading || target.heading,
            position: target.position,
            hubNotesFolder: settings.eventTask.hubNotesFolder,
            detailNotesFolder: settings.eventTask.detailNotesFolder,
            inbox: settings.inbox
        });
    }

    open(owner?: Component): void {
        if (this.rootEl || document.querySelector(".fn-mobile-event-screen")) return;

        this.rootEl = this.app.workspace.containerEl.createDiv({
            cls: "fn-mobile-event-screen",
            attr: { role: "dialog", "aria-modal": "true", "aria-label": "Create inbox item, event, or task" }
        });
        document.body.addClass("fn-mobile-event-screen-open");
        this.render();
        this.registerLifecycle();
        if (owner) {
            this.owner = owner;
            owner.addChild(this);
        } else {
            this.load();
        }
    }

    close(): void {
        if (!this.rootEl) return;
        this.resolved = true;
        if (this.owner) {
            const owner = this.owner;
            this.owner = null;
            owner.removeChild(this);
        } else {
            this.unload();
        }
    }

    onunload(): void {
        this.rootEl?.remove();
        this.rootEl = null;
        this.bodyEl = null;
        this.owner = null;
        document.body.removeClass("fn-mobile-event-screen-open");
    }

    private render(): void {
        const root = this.rootEl!;
        root.createDiv({ cls: "fn-mobile-event-handle", attr: { "aria-hidden": "true" } });
        const header = root.createEl("header", { cls: "fn-mobile-event-header" });
        const cancel = header.createEl("button", {
            cls: "fn-mobile-event-cancel",
            attr: { type: "button", "aria-label": "Cancel" }
        });
        setIcon(cancel, "x");
        const save = header.createEl("button", {
            cls: "fn-mobile-event-save mod-cta",
            text: "Save",
            attr: { type: "button" }
        });

        this.bodyEl = root.createEl("main", { cls: "fn-mobile-event-body" });
        const title = this.bodyEl.createEl("input", {
            type: "text",
            cls: "fn-mobile-event-title",
            attr: { placeholder: "Add title", "aria-label": "Title" }
        });
        title.value = this.form.getTitleForKind(this.form.kind);
        this.registerDomEvent(title, "input", () => this.setTitle(title.value));
        this.registerDomEvent(title, "keydown", event => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void this.submit();
            }
        });

        const eventTaskFields = this.bodyEl.createDiv({ cls: "fn-mobile-event-task-fields" });
        const eventSection = eventTaskFields.createDiv({ cls: "fn-mobile-event-primary" });
        const taskSection = eventTaskFields.createDiv({ cls: "fn-mobile-event-primary fn-gcal-hidden" });
        const taskOptions = eventTaskFields.createDiv({ cls: "fn-mobile-event-task-options fn-gcal-hidden" });
        const inboxSection = this.bodyEl.createDiv({ cls: "fn-mobile-inbox-primary fn-gcal-hidden" });
        this.renderKindSelector(this.bodyEl, kind => {
            title.value = this.form.getTitleForKind(kind);
            const isInbox = kind === "inbox";
            const isEvent = kind === "event";
            eventTaskFields.toggleClass("fn-gcal-hidden", isInbox);
            inboxSection.toggleClass("fn-gcal-hidden", !isInbox);
            eventSection.toggleClass("fn-gcal-hidden", !isEvent);
            taskSection.toggleClass("fn-gcal-hidden", isInbox || isEvent);
            taskOptions.toggleClass("fn-gcal-hidden", isInbox || isEvent);
        }, eventTaskFields);
        this.renderEventFields(eventSection);
        this.renderTaskDueFields(taskSection);
        this.renderDescription(eventTaskFields);

        const options = this.disclosure(eventTaskFields, "More options", "sliders-horizontal", "Notes, details, and destination");
        const timebox = this.disclosure(taskOptions, "Timebox", "timer");
        this.renderTaskTimebox(timebox);
        const reminders = this.disclosure(taskOptions, "Reminders", "bell");
        this.renderReminders(reminders);
        options.appendChild(taskOptions);
        this.renderRelatedNote(this.disclosure(options, "Related note", "link"));
        this.renderDetailNote(this.disclosure(options, "Detail note", "file-text"));
        this.renderSaveTarget(this.disclosure(options, "Save to", "folder", this.form.targetFile));

        new InboxMobileForm({
            app: this.app,
            form: this.form,
            getSettings: this.getSettings,
            resolveTarget: () => this.resolveInboxTarget(),
            registerCleanup: cleanup => this.register(cleanup)
        }).render(inboxSection);

        this.registerDomEvent(cancel, "click", () => this.close());
        this.registerDomEvent(save, "click", () => void this.submit());
        const focusTimer = window.setTimeout(() => title.focus(), 50);
        this.register(() => window.clearTimeout(focusTimer));
    }

    private renderKindSelector(
        container: HTMLElement,
        onChange: (kind: EventTaskKind) => void,
        before: HTMLElement
    ): void {
        const group = container.createDiv({
            cls: "fn-mobile-event-kind",
            attr: { role: "group", "aria-label": "Item type" }
        });
        container.insertBefore(group, before);
        const inboxButton = group.createEl("button", {
            cls: "fn-mobile-event-kind-button",
            text: "Inbox",
            attr: { type: "button", "aria-pressed": "false" }
        });
        const eventButton = group.createEl("button", {
            cls: "fn-mobile-event-kind-button is-active",
            text: "Event",
            attr: { type: "button", "aria-pressed": "true" }
        });
        const taskButton = group.createEl("button", {
            cls: "fn-mobile-event-kind-button",
            text: "Task",
            attr: { type: "button", "aria-pressed": "false" }
        });
        const activate = (kind: EventTaskKind): void => {
            this.form.kind = kind;
            const isInbox = kind === "inbox";
            const isEvent = kind === "event";
            inboxButton.toggleClass("is-active", isInbox);
            eventButton.toggleClass("is-active", isEvent);
            taskButton.toggleClass("is-active", !isInbox && !isEvent);
            inboxButton.setAttribute("aria-pressed", String(isInbox));
            eventButton.setAttribute("aria-pressed", String(isEvent));
            taskButton.setAttribute("aria-pressed", String(!isInbox && !isEvent));
            onChange(kind);
        };
        this.registerDomEvent(inboxButton, "click", () => activate("inbox"));
        this.registerDomEvent(eventButton, "click", () => activate("event"));
        this.registerDomEvent(taskButton, "click", () => activate("task"));
    }

    private renderEventFields(container: HTMLElement): void {
        const card = this.fieldGroup(container, "When", "calendar-clock");
        const date = this.input(card, "date", "Event date", this.form.eventDate);
        const times = card.createDiv({ cls: "fn-mobile-event-grid" });
        const start = this.input(times, "time", "Start time", this.form.eventStartTime);
        const end = this.input(times, "time", "End time", this.form.eventEndTime);
        const allDay = this.checkbox(card, "All day", this.form.eventAllDay, checked => {
            this.form.eventAllDay = checked;
            times.toggleClass("fn-gcal-hidden", checked);
        });
        this.registerDomEvent(date, "change", () => this.form.eventDate = date.value);
        this.registerDomEvent(start, "change", () => this.form.eventStartTime = start.value);
        this.registerDomEvent(end, "change", () => this.form.eventEndTime = end.value);
        allDay.checked = this.form.eventAllDay;
    }

    private renderTaskDueFields(container: HTMLElement): void {
        const card = this.fieldGroup(container, "Due date", "calendar");
        const row = card.createDiv({ cls: "fn-mobile-event-grid" });
        const date = this.input(row, "date", "Due date", this.form.taskDueDate);
        const time = this.input(row, "time", "Due time", this.form.taskDueTime);
        time.toggleClass("fn-gcal-hidden", !this.form.taskDueHasTime);
        this.checkbox(card, "Include time", this.form.taskDueHasTime, checked => {
            this.form.taskDueHasTime = checked;
            time.toggleClass("fn-gcal-hidden", !checked);
        });
        this.registerDomEvent(date, "change", () => this.form.taskDueDate = date.value);
        this.registerDomEvent(time, "change", () => this.form.taskDueTime = time.value);
    }

    private renderDescription(container: HTMLElement): void {
        const card = this.fieldGroup(container, "Description", "align-left");
        const description = card.createEl("textarea", {
            cls: "fn-mobile-event-description",
            attr: { placeholder: "Add description or attachment…", "aria-label": "Description" }
        });
        description.rows = 2;
        this.registerDomEvent(description, "input", () => this.form.description = description.value);
    }

    private renderTaskTimebox(container: HTMLElement): void {
        const toggleHost = container.createDiv();
        const fields = container.createDiv({ cls: "fn-mobile-event-conditional fn-gcal-hidden" });
        this.checkbox(toggleHost, "Enable timebox", false, checked => {
            this.form.taskTimeboxEnabled = checked;
            fields.toggleClass("fn-gcal-hidden", !checked);
        });
        const date = this.input(fields, "date", "Timebox date", this.form.taskTimeboxDate);
        const times = fields.createDiv({ cls: "fn-mobile-event-grid" });
        const start = this.input(times, "time", "Timebox start", this.form.taskTimeboxStartTime);
        const end = this.input(times, "time", "Timebox end", this.form.taskTimeboxEndTime);
        this.registerDomEvent(date, "change", () => this.form.taskTimeboxDate = date.value);
        this.registerDomEvent(start, "change", () => this.form.taskTimeboxStartTime = start.value);
        this.registerDomEvent(end, "change", () => this.form.taskTimeboxEndTime = end.value);
    }

    private renderReminders(container: HTMLElement): void {
        const list = container.createDiv({ cls: "fn-mobile-event-reminders" });
        const add = container.createEl("button", {
            cls: "fn-mobile-event-secondary-action",
            text: "Add reminder",
            attr: { type: "button" }
        });
        this.registerDomEvent(add, "click", () => {
            const index = this.form.reminders.length;
            this.form.reminders.push({ date: formatLocalDate(this.anchorDate), time: "09:00" });
            this.renderReminderRow(list, index);
        });
    }

    private renderReminderRow(container: HTMLElement, index: number): void {
        const reminder = this.form.reminders[index];
        const row = container.createDiv({ cls: "fn-mobile-event-reminder" });
        const date = this.input(row, "date", "Reminder date", reminder.date);
        const time = this.input(row, "time", "Reminder time", reminder.time);
        const remove = row.createEl("button", {
            cls: "fn-mobile-event-remove",
            attr: { type: "button", "aria-label": "Remove reminder" }
        });
        setIcon(remove, "x");
        this.registerDomEvent(date, "change", () => reminder.date = date.value);
        this.registerDomEvent(time, "change", () => reminder.time = time.value);
        this.registerDomEvent(remove, "click", () => {
            reminder.date = "";
            row.remove();
        });
    }

    private renderRelatedNote(container: HTMLElement): void {
        const modeHost = container.createDiv();
        const inputRow = container.createDiv({ cls: "fn-mobile-event-related-input fn-gcal-hidden" });
        const noteField = this.iconInput(inputRow, "search", "Related note", "", "Search notes…");
        const note = noteField.input;
        const pick = inputRow.createEl("button", {
            cls: "fn-mobile-event-pick",
            text: "Pick",
            attr: { type: "button" }
        });
        this.registerSuggester(new FileSuggest(this.app, note));
        const folderField = this.iconInput(
            container,
            "folder",
            "Related note folder",
            this.form.hubCreateFolder,
            "Folder for new note"
        );
        const folder = folderField.input;
        folderField.wrapper.addClass("fn-gcal-hidden");
        this.registerSuggester(new FolderSuggest(this.app, folder));
        const alsoWrap = container.createDiv({ cls: "fn-gcal-hidden" });
        this.checkbox(alsoWrap, "Also write to related note", false, checked => this.form.writeToHubNote = checked);

        this.segmented<HubMode>(modeHost, [
            { value: "none", label: "None" },
            { value: "link", label: "Link" },
            { value: "create", label: "New note" }
        ], "none", mode => {
            this.form.hubMode = mode;
            inputRow.toggleClass("fn-gcal-hidden", mode === "none");
            folderField.wrapper.toggleClass("fn-gcal-hidden", mode !== "create");
            pick.toggleClass("fn-gcal-hidden", mode !== "link");
            alsoWrap.toggleClass("fn-gcal-hidden", mode === "none");
            note.placeholder = mode === "create" ? "New note name" : "Search notes…";
            noteField.icon.empty();
            setIcon(noteField.icon, mode === "create" ? "file-text" : "search");
            note.value = mode === "create" ? this.form.title : "";
            if (mode === "create") this.form.hubCreateName = note.value;
            if (mode === "link") this.form.hubLinkPath = "";
        });
        this.registerDomEvent(note, "input", () => {
            if (this.form.hubMode === "link") this.form.hubLinkPath = note.value;
            if (this.form.hubMode === "create") this.form.hubCreateName = note.value;
        });
        this.registerDomEvent(folder, "input", () => this.form.hubCreateFolder = folder.value);
        this.registerDomEvent(pick, "click", () => {
            const picker = new MobileFilePicker(this.app, file => {
                note.value = file.path;
                this.form.hubLinkPath = file.path;
            });
            this.register(() => picker.close());
            picker.open();
        });
    }

    private renderDetailNote(container: HTMLElement): void {
        const toggleHost = container.createDiv();
        const fields = container.createDiv({ cls: "fn-mobile-event-conditional fn-gcal-hidden" });
        const name = this.iconInput(fields, "file-text", "Detail note name", "", "Detail note name").input;
        const folder = this.iconInput(
            fields,
            "folder",
            "Detail note folder",
            this.form.detailNoteFolder,
            "Folder for detail note"
        ).input;
        this.registerSuggester(new FolderSuggest(this.app, folder));
        this.checkbox(toggleHost, "Create detail note", false, checked => {
            this.form.detailNoteEnabled = checked;
            fields.toggleClass("fn-gcal-hidden", !checked);
            if (checked && !name.value) {
                name.value = this.form.title;
                this.form.detailNoteName = name.value;
            }
        });
        this.registerDomEvent(name, "input", () => this.form.detailNoteName = name.value);
        this.registerDomEvent(folder, "input", () => this.form.detailNoteFolder = folder.value);
    }

    private renderSaveTarget(container: HTMLElement): void {
        const file = this.iconInput(container, "file-text", "Save to file", this.form.targetFile, "Note path").input;
        const heading = this.iconInput(
            container,
            "hash",
            "Save under heading",
            this.form.targetHeading,
            "Heading (optional)"
        ).input;
        this.registerSuggester(new FileSuggest(this.app, file));
        this.checkbox(container, "Insert at top", this.form.targetPosition === "start", checked => {
            this.form.targetPosition = checked ? "start" : "end";
        });
        this.registerDomEvent(file, "input", () => this.form.targetFile = file.value);
        this.registerDomEvent(heading, "input", () => this.form.targetHeading = heading.value);
    }

    private setTitle(value: string): void {
        if (this.form.kind === "inbox") {
            this.form.inboxTitle = value;
            return;
        }
        const previous = this.form.title;
        this.form.title = value;
        if (this.form.hubMode === "create" && (!this.form.hubCreateName || this.form.hubCreateName === previous)) {
            this.form.hubCreateName = value;
            const relatedName = this.rootEl?.querySelector<HTMLInputElement>(".fn-mobile-event-related-input input");
            if (relatedName && (!relatedName.value || relatedName.value === previous)) relatedName.value = value;
        }
    }

    private fieldGroup(container: HTMLElement, label: string, icon: string): HTMLElement {
        const row = container.createDiv({ cls: "fn-mobile-event-field-row" });
        const iconEl = row.createSpan({ cls: "fn-mobile-event-field-icon" });
        setIcon(iconEl, icon);
        const fields = row.createDiv({ cls: "fn-mobile-event-field-content" });
        fields.createDiv({ cls: "fn-mobile-event-label", text: label });
        return fields;
    }

    private input(
        container: HTMLElement,
        type: "text" | "date" | "time",
        label: string,
        value: string,
        placeholder?: string
    ): HTMLInputElement {
        const input = container.createEl("input", {
            type,
            cls: "fn-mobile-event-input",
            attr: { "aria-label": label, ...(placeholder ? { placeholder } : {}) }
        });
        input.value = value;
        return input;
    }

    private iconInput(
        container: HTMLElement,
        icon: string,
        label: string,
        value: string,
        placeholder?: string
    ): { wrapper: HTMLElement; icon: HTMLElement; input: HTMLInputElement } {
        const wrapper = container.createDiv({ cls: "fn-mobile-event-icon-input" });
        const iconEl = wrapper.createSpan({
            cls: "fn-mobile-event-input-icon",
            attr: { "aria-hidden": "true" }
        });
        setIcon(iconEl, icon);
        const input = this.input(wrapper, "text", label, value, placeholder);
        return { wrapper, icon: iconEl, input };
    }

    private checkbox(
        container: HTMLElement,
        label: string,
        initial: boolean,
        onChange: (checked: boolean) => void
    ): HTMLInputElement {
        const row = container.createEl("label", { cls: "fn-mobile-event-toggle" });
        const input = row.createEl("input", { type: "checkbox" });
        input.checked = initial;
        row.createSpan({ text: label });
        this.registerDomEvent(input, "change", () => onChange(input.checked));
        return input;
    }

    private segmented<T extends string>(
        container: HTMLElement,
        options: Array<{ value: T; label: string }>,
        initial: T,
        onChange: (value: T) => void
    ): void {
        const group = container.createDiv({ cls: "fn-mobile-event-segmented", attr: { role: "group" } });
        for (const option of options) {
            const button = group.createEl("button", {
                cls: "fn-mobile-event-segment" + (option.value === initial ? " is-active" : ""),
                text: option.label,
                attr: { type: "button", "aria-pressed": String(option.value === initial) }
            });
            this.registerDomEvent(button, "click", () => {
                group.querySelectorAll<HTMLElement>(".fn-mobile-event-segment").forEach(element => {
                    element.removeClass("is-active");
                    element.setAttribute("aria-pressed", "false");
                });
                button.addClass("is-active");
                button.setAttribute("aria-pressed", "true");
                onChange(option.value);
            });
        }
    }

    private disclosure(container: HTMLElement, label: string, icon: string, value?: string): HTMLElement {
        const details = container.createEl("details", { cls: "fn-mobile-event-disclosure" });
        const summary = details.createEl("summary", { cls: "fn-mobile-event-summary" });
        const iconEl = summary.createSpan({ cls: "fn-mobile-event-summary-icon" });
        setIcon(iconEl, icon);
        const text = summary.createSpan({ cls: "fn-mobile-event-summary-text" });
        text.createSpan({ text: label });
        if (value) text.createEl("small", { text: value });
        const chevron = summary.createSpan({ cls: "fn-mobile-event-summary-chevron" });
        setIcon(chevron, "chevron-down");
        return details.createDiv({ cls: "fn-mobile-event-disclosure-content" });
    }

    private registerSuggester(suggester: { close(): void }): void {
        this.register(() => suggester.close());
    }

    private registerLifecycle(): void {
        const root = this.rootEl!;
        const viewport = window.visualViewport;
        const updateViewport = (): void => {
            const workspaceTop = this.app.workspace.containerEl.getBoundingClientRect().top;
            const metrics = getMobileViewportMetrics(window.innerHeight, viewport ?? undefined, workspaceTop, 8);
            root.style.setProperty("--fn-mobile-screen-height", `${metrics.height}px`);
            root.style.setProperty("--fn-mobile-screen-top", `${metrics.offsetTop}px`);
        };
        const revealFocusedField = (): void => {
            const active = document.activeElement;
            if (!(active instanceof HTMLElement) || !root.contains(active)) return;
            window.setTimeout(() => active.scrollIntoView({ block: "nearest", inline: "nearest" }), 50);
        };
        updateViewport();
        this.registerDomEvent(window, "resize", updateViewport);
        this.registerDomEvent(window, "keydown", event => {
            if (event.key === "Escape") {
                event.preventDefault();
                this.close();
            }
        });
        this.registerDomEvent(root, "focusin", revealFocusedField);
        if (viewport) {
            viewport.addEventListener("resize", updateViewport);
            viewport.addEventListener("scroll", updateViewport);
            viewport.addEventListener("resize", revealFocusedField);
            this.register(() => {
                viewport.removeEventListener("resize", updateViewport);
                viewport.removeEventListener("scroll", updateViewport);
                viewport.removeEventListener("resize", revealFocusedField);
            });
        }
    }

    private async submit(): Promise<void> {
        if (this.resolved || this.submitting) return;
        const settings = this.getSettings();
        const writer = new EventTaskWriter(this.app, settings.eventTask);
        if (this.form.kind === "inbox") {
            this.submitting = true;
            const result = await submitInbox(this.form, {
                writer,
                resolveTarget: () => this.resolveInboxTarget()
            });
            this.submitting = false;
            this.finishSubmission(result);
            return;
        }
        if (!this.form.title.trim()) {
            new Notice("Please enter a title.");
            return;
        }
        if (!this.form.targetFile.trim()) {
            new Notice("Please select a target file.");
            return;
        }

        this.submitting = true;
        const result = await submitEventTask(this.form, {
            writer,
            defaultHubNotesFolder: settings.eventTask.hubNotesFolder,
            defaultDetailNotesFolder: settings.eventTask.detailNotesFolder,
            resolveTargetFile: record => this.resolveTargetFile(record),
            findMarkdownFile: path => {
                const file = this.app.vault.getAbstractFileByPath(path);
                return isTFile(file) ? file : null;
            },
            openFile: file => {
                const vaultFile = this.app.vault.getAbstractFileByPath(file.path);
                if (isTFile(vaultFile)) void this.app.workspace.getLeaf(false).openFile(vaultFile, { active: false });
            }
        });
        this.submitting = false;
        this.finishSubmission(result);
    }

    private finishSubmission(result: { ok: boolean; message: string }): void {
        new Notice(result.message);
        if (result.ok) {
            this.resolved = true;
            this.onComplete();
            this.close();
        }
    }

    private resolveInboxTarget(): FocusTarget | null {
        const resolver = new TargetResolver(this.app, this.getSettings());
        const override = this.form.inboxTargetFileOverride.trim();
        if (override) {
            return resolver.resolve({
                file: override,
                heading: this.form.inboxHeading.replace(/^#+\s*/, "").trim(),
                position: this.form.inboxPosition
            }, this.form.inboxCapturedAt);
        }
        return selectInboxTarget({
            mode: this.form.inboxTargetMode,
            dailyNoteTarget: resolver.getDailyNoteTarget(this.form.inboxCapturedAt),
            eventTaskTarget: resolver.resolve({
                file: this.form.targetFile,
                heading: this.form.targetHeading,
                position: this.form.targetPosition
            }, this.form.inboxCapturedAt),
            heading: this.form.inboxHeading,
            position: this.form.inboxPosition
        });
    }

    private resolveTargetFile(record: EventTaskRecord): string {
        const when = record.kind === "event"
            ? record.start
            : record.due ?? record.timebox?.start ?? this.anchorDate;
        const target: FocusTarget = {
            file: this.form.targetFile.trim(),
            heading: this.form.targetHeading.trim(),
            position: this.form.targetPosition
        };
        return new TargetResolver(this.app, this.getSettings()).resolve(target, when).file;
    }
}

class MobileFilePicker extends FuzzySuggestModal<TFile> {
    constructor(app: App, private readonly onPick: (file: TFile) => void) {
        super(app);
        this.setPlaceholder("Pick a note…");
    }

    getItems(): TFile[] {
        return this.app.vault.getMarkdownFiles();
    }

    getItemText(file: TFile): string {
        return file.path;
    }

    onChooseItem(file: TFile): void {
        this.onPick(file);
    }
}
