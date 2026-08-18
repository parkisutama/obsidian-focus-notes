import { type App, Component, Notice, setIcon } from "obsidian";
import { preferActiveNoteTarget } from "./CaptureTarget";
import { EventTaskFormState, type EventTaskKind, formatLocalDate } from "./EventTaskFormState";
import type { OpenEventTaskFormOptions } from "./EventTaskModal";
import {
    type EventTaskSubmissionResult,
    type PartialSubmissionResult,
    retryRelatedSubmission,
    submitEventTask,
    submitInbox,
} from "./EventTaskSubmission";
import { type EventTaskRecord, EventTaskWriter } from "./EventTaskWriter";
import { InboxMobileForm } from "./InboxMobileForm";
import { ContextNotesController } from "./InboxNotesController";
import { resolveInboxFormTarget, selectInboxTarget } from "./InboxTarget";
import { getMobileViewportMetrics } from "./MobileViewport";
import { readContextSuggestionNotes } from "./ObsidianInboxSuggestionSource";
import { createObsidianLinkResolver } from "./ObsidianLinkResolver.ts";
import { openMobileScheduledItemCreate } from "./ScheduledItemMobileCreateLauncher.ts";
import { SubmissionPolicy } from "./SubmissionPolicy";
import { FileSuggest, FolderSuggest } from "./Suggesters";
import { TargetResolver } from "./TargetResolver";
import { assessTimelineTargetGroups, buildTimelineSourceGroups } from "./TimelineSourceGroups";
import type { FocusNotesSettings, FocusTarget } from "./types";
import { isTFile } from "./utils";

export class EventTaskMobileScreen extends Component {
    private rootEl: HTMLElement | null = null;
    private bodyEl: HTMLElement | null = null;
    private saveButtonEl: HTMLButtonElement | null = null;
    private resolved = false;
    private readonly submissionPolicy = new SubmissionPolicy();
    private owner: Component | null = null;
    private readonly form: EventTaskFormState;
    private contextNotesController: ContextNotesController | null = null;
    private pendingRecovery: PartialSubmissionResult | null = null;
    private recoveryInFlight = false;
    private completionNotified = false;

    constructor(
        private readonly app: App,
        private readonly getSettings: () => FocusNotesSettings,
        private readonly anchorDate: Date = new Date(),
        private readonly onComplete: () => void = () => {},
        options: OpenEventTaskFormOptions = {},
    ) {
        super();
        const settings = getSettings();
        const resolver = new TargetResolver(app, settings);
        const configured = resolver.resolve(resolver.getActiveTarget(), anchorDate);
        const activeFile = app.workspace.getActiveFile();
        const target = preferActiveNoteTarget(
            configured,
            options.targetFile ?? (activeFile?.extension === "md" ? activeFile.path : null),
        );
        const inboxTarget = selectInboxTarget({
            mode: settings.inbox.defaultTargetMode,
            dailyNoteTarget: resolver.getDailyNoteTarget(anchorDate),
            eventTaskTarget: target,
            heading: settings.inbox.heading,
            position: settings.inbox.position,
        });
        this.form = new EventTaskFormState(anchorDate, {
            file: target.file,
            heading: settings.eventTask.defaultSaveHeading || target.heading,
            position: target.position,
            hubNotesFolder: settings.eventTask.hubNotesFolder,
            detailNotesFolder: settings.eventTask.detailNotesFolder,
            inbox: settings.inbox,
            inboxTargetFile: inboxTarget?.file ?? "",
        });
        this.form.kind = options.initialKind ?? "inbox";
    }

    open(owner?: Component): void {
        if (this.rootEl || document.querySelector(".fn-mobile-event-screen")) return;

        this.rootEl = this.app.workspace.containerEl.createDiv({
            cls: "fn-mobile-event-screen",
            attr: { role: "dialog", "aria-modal": "true", "aria-label": "Create inbox item, event, or task" },
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
        const root = this.rootEl;
        if (!root) return;
        root.createDiv({ cls: "fn-mobile-event-handle", attr: { "aria-hidden": "true" } });
        const header = root.createEl("header", { cls: "fn-mobile-event-header" });
        const cancel = header.createEl("button", {
            cls: "fn-mobile-event-cancel",
            attr: { type: "button", "aria-label": "Cancel" },
        });
        setIcon(cancel, "x");
        const save = header.createEl("button", {
            cls: "fn-mobile-event-save mod-cta",
            text: "Save",
            attr: { type: "button" },
        });
        this.saveButtonEl = save;

        this.bodyEl = root.createEl("main", { cls: "fn-mobile-event-body" });
        const title = this.bodyEl.createEl("input", {
            type: "text",
            cls: "fn-mobile-event-title",
            attr: { placeholder: "Add title", "aria-label": "Title" },
        });
        title.value = this.form.getTitleForKind(this.form.kind);
        this.registerDomEvent(title, "input", () => this.setTitle(title.value));
        this.registerDomEvent(title, "keydown", (event) => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void this.submit();
            }
        });

        const eventTaskFields = this.bodyEl.createDiv({ cls: "fn-mobile-event-task-fields fn-gcal-hidden" });
        const eventSection = eventTaskFields.createDiv({ cls: "fn-mobile-event-primary" });
        const taskSection = eventTaskFields.createDiv({ cls: "fn-mobile-event-primary fn-gcal-hidden" });
        const taskOptions = eventTaskFields.createDiv({ cls: "fn-mobile-event-task-options fn-gcal-hidden" });
        const inboxSection = this.bodyEl.createDiv({ cls: "fn-mobile-inbox-primary" });
        this.renderKindSelector(
            this.bodyEl,
            (kind) => {
                title.value = this.form.getTitleForKind(kind);
                const isInbox = kind === "inbox";
                const isEvent = kind === "event";
                eventTaskFields.toggleClass("fn-gcal-hidden", isInbox);
                inboxSection.toggleClass("fn-gcal-hidden", !isInbox);
                eventSection.toggleClass("fn-gcal-hidden", !isEvent);
                taskSection.toggleClass("fn-gcal-hidden", isInbox || isEvent);
                taskOptions.toggleClass("fn-gcal-hidden", isInbox || isEvent);
            },
            eventTaskFields,
        );
        this.renderEventFields(eventSection);
        this.renderEventLifecycleFields(eventSection);
        this.renderTaskDueFields(taskSection);
        this.renderTaskPriorityFields(taskSection);
        this.renderDescription(eventTaskFields);

        const options = this.disclosure(
            eventTaskFields,
            "More options",
            "sliders-horizontal",
            "Notes, details, and destination",
        );
        const timebox = this.disclosure(taskOptions, "Timebox", "timer");
        this.renderTaskTimebox(timebox);
        const reminders = this.disclosure(taskOptions, "Reminders", "bell");
        this.renderReminders(reminders);
        options.appendChild(taskOptions);
        this.renderDetailNote(this.disclosure(options, "Detail note", "file-text"));
        this.renderSaveTarget(this.disclosure(options, "Save to", "folder", this.form.targetFile));

        new InboxMobileForm({
            app: this.app,
            form: this.form,
            getSettings: this.getSettings,
            resolveTarget: () => this.resolveInboxTarget(),
            registerCleanup: (cleanup) => this.register(cleanup),
        }).render(inboxSection);

        this.registerDomEvent(cancel, "click", () => this.close());
        this.registerDomEvent(save, "click", () => void this.submit());
        const focusTimer = window.setTimeout(() => title.focus(), 50);
        this.register(() => window.clearTimeout(focusTimer));
    }

    private renderTaskPriorityFields(container: HTMLElement): void {
        const card = this.fieldGroup(container, "Priority", "signal");
        this.segmented(
            card,
            [
                { value: "normal", label: "Normal" },
                { value: "low", label: "Low" },
                { value: "medium", label: "Medium" },
                { value: "high", label: "High" },
            ],
            this.form.taskPriority,
            (priority) => (this.form.taskPriority = priority),
        );
    }

    private renderKindSelector(
        container: HTMLElement,
        onChange: (kind: EventTaskKind) => void,
        before: HTMLElement,
    ): void {
        const group = container.createDiv({
            cls: "fn-mobile-event-kind",
            attr: { role: "group", "aria-label": "Item type" },
        });
        container.insertBefore(group, before);
        const inboxButton = group.createEl("button", {
            cls: "fn-mobile-event-kind-button is-active",
            text: "Inbox",
            attr: { type: "button", "aria-pressed": "true" },
        });
        const eventButton = group.createEl("button", {
            cls: "fn-mobile-event-kind-button",
            text: "Event",
            attr: { type: "button", "aria-pressed": "false" },
        });
        const taskButton = group.createEl("button", {
            cls: "fn-mobile-event-kind-button",
            text: "Task",
            attr: { type: "button", "aria-pressed": "false" },
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
        this.registerDomEvent(eventButton, "click", () => this.openScheduledItemCreate("event"));
        this.registerDomEvent(taskButton, "click", () => this.openScheduledItemCreate("task"));
        activate(this.form.kind);
    }

    private openScheduledItemCreate(kind: "task" | "event"): void {
        const targetFile = this.form.targetFile;
        this.close();
        openMobileScheduledItemCreate(this.app, this.getSettings, this.anchorDate, this.onComplete, kind, targetFile);
    }

    private renderEventFields(container: HTMLElement): void {
        const card = this.fieldGroup(container, "When", "calendar-clock");
        const date = this.input(card, "date", "Event date", this.form.eventDate);
        const times = card.createDiv({ cls: "fn-mobile-event-grid" });
        const start = this.input(times, "time", "Start time", this.form.eventStartTime);
        const end = this.input(times, "time", "End time", this.form.eventEndTime);
        const allDay = this.checkbox(card, "All day", this.form.eventAllDay, (checked) => {
            this.form.eventAllDay = checked;
            times.toggleClass("fn-gcal-hidden", checked);
        });
        this.registerDomEvent(date, "change", () => (this.form.eventDate = date.value));
        this.registerDomEvent(start, "change", () => (this.form.eventStartTime = start.value));
        this.registerDomEvent(end, "change", () => (this.form.eventEndTime = end.value));
        allDay.checked = this.form.eventAllDay;
    }

    private renderEventLifecycleFields(container: HTMLElement): void {
        const statusCard = this.fieldGroup(container, "Status", "circle-dot");
        const actualCard = this.fieldGroup(container, "Actual time", "clock-check");
        let actualFields: HTMLElement;
        const actualToggle = this.checkbox(actualCard, "Record different actual time", false, (checked) => {
            this.form.eventActualTimeEnabled = checked;
            actualFields.toggleClass("fn-gcal-hidden", !checked);
        });
        actualFields = actualCard.createDiv({ cls: "fn-mobile-event-conditional fn-gcal-hidden" });
        const startRow = actualFields.createDiv({ cls: "fn-mobile-event-grid" });
        const startDate = this.input(startRow, "date", "Actual start date", this.form.eventActualStartDate);
        const startTime = this.input(startRow, "time", "Actual start time", this.form.eventActualStartTime);
        const endRow = actualFields.createDiv({ cls: "fn-mobile-event-grid" });
        const endDate = this.input(endRow, "date", "Actual end date", this.form.eventActualEndDate);
        const endTime = this.input(endRow, "time", "Actual end time", this.form.eventActualEndTime);
        this.segmented(
            statusCard,
            [
                { value: "planned", label: "Planned" },
                { value: "completed", label: "Completed" },
                { value: "cancelled", label: "Cancelled" },
            ],
            this.form.eventStatus,
            (status) => {
                this.form.eventStatus = status;
                const canRecordActual = status === "completed";
                actualCard.toggleClass("fn-gcal-hidden", !canRecordActual);
                if (!canRecordActual) {
                    actualToggle.checked = false;
                    this.form.eventActualTimeEnabled = false;
                    actualFields.addClass("fn-gcal-hidden");
                }
            },
        );
        actualCard.addClass("fn-gcal-hidden");
        this.registerDomEvent(startDate, "change", () => (this.form.eventActualStartDate = startDate.value));
        this.registerDomEvent(startTime, "change", () => (this.form.eventActualStartTime = startTime.value));
        this.registerDomEvent(endDate, "change", () => (this.form.eventActualEndDate = endDate.value));
        this.registerDomEvent(endTime, "change", () => (this.form.eventActualEndTime = endTime.value));
    }

    private renderTaskDueFields(container: HTMLElement): void {
        const card = this.fieldGroup(container, "Due date", "calendar");
        const row = card.createDiv({ cls: "fn-mobile-event-grid" });
        const date = this.input(row, "date", "Due date", this.form.taskDueDate);
        const time = this.input(row, "time", "Due time", this.form.taskDueTime);
        time.toggleClass("fn-gcal-hidden", !this.form.taskDueHasTime);
        this.checkbox(card, "Include time", this.form.taskDueHasTime, (checked) => {
            this.form.taskDueHasTime = checked;
            time.toggleClass("fn-gcal-hidden", !checked);
        });
        this.registerDomEvent(date, "change", () => (this.form.taskDueDate = date.value));
        this.registerDomEvent(time, "change", () => (this.form.taskDueTime = time.value));
    }

    private renderDescription(container: HTMLElement): void {
        const card = this.fieldGroup(container, "Description", "align-left");
        const editor = card.createDiv({
            cls: "fn-mobile-event-description",
            attr: {
                "data-placeholder": "Add description. Use @ for contextual notes, # for tags.",
                "aria-label": "Description",
            },
        });
        const controller = new ContextNotesController(this.app, editor, {
            initialValue: this.form.description,
            targetFile: this.form.targetFile,
            getContextSources: () => this.getSettings().inbox.contextSources,
            onChange: (value) => (this.form.description = value),
            referenceFormat: "object-reference",
        });
        this.contextNotesController = controller;
        this.register(() => {
            controller.destroy();
            if (this.contextNotesController === controller) this.contextNotesController = null;
        });
    }

    private renderTaskTimebox(container: HTMLElement): void {
        const toggleHost = container.createDiv();
        const fields = container.createDiv({ cls: "fn-mobile-event-conditional fn-gcal-hidden" });
        this.checkbox(toggleHost, "Enable timebox", false, (checked) => {
            this.form.taskTimeboxEnabled = checked;
            fields.toggleClass("fn-gcal-hidden", !checked);
        });
        const date = this.input(fields, "date", "Timebox date", this.form.taskTimeboxDate);
        const times = fields.createDiv({ cls: "fn-mobile-event-grid" });
        const start = this.input(times, "time", "Timebox start", this.form.taskTimeboxStartTime);
        const end = this.input(times, "time", "Timebox end", this.form.taskTimeboxEndTime);
        this.registerDomEvent(date, "change", () => (this.form.taskTimeboxDate = date.value));
        this.registerDomEvent(start, "change", () => (this.form.taskTimeboxStartTime = start.value));
        this.registerDomEvent(end, "change", () => (this.form.taskTimeboxEndTime = end.value));
    }

    private renderReminders(container: HTMLElement): void {
        const list = container.createDiv({ cls: "fn-mobile-event-reminders" });
        const add = container.createEl("button", {
            cls: "fn-mobile-event-secondary-action",
            text: "Add reminder",
            attr: { type: "button" },
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
            attr: { type: "button", "aria-label": "Remove reminder" },
        });
        setIcon(remove, "x");
        this.registerDomEvent(date, "change", () => (reminder.date = date.value));
        this.registerDomEvent(time, "change", () => (reminder.time = time.value));
        this.registerDomEvent(remove, "click", () => {
            reminder.date = "";
            row.remove();
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
            "Folder for detail note",
        ).input;
        this.registerSuggester(new FolderSuggest(this.app, folder));
        this.checkbox(toggleHost, "Create detail note", false, (checked) => {
            this.form.detailNoteEnabled = checked;
            fields.toggleClass("fn-gcal-hidden", !checked);
            if (checked && !name.value) {
                name.value = this.form.title;
                this.form.detailNoteName = name.value;
            }
        });
        this.registerDomEvent(name, "input", () => (this.form.detailNoteName = name.value));
        this.registerDomEvent(folder, "input", () => (this.form.detailNoteFolder = folder.value));
    }

    private renderSaveTarget(container: HTMLElement): void {
        const file = this.iconInput(container, "file-text", "Save to file", this.form.targetFile, "Note path").input;
        const alignment = container.createDiv({ cls: "fn-capture-timeline-alignment" });
        const updateAlignment = (): void => {
            const settings = this.getSettings();
            const resolver = new TargetResolver(this.app, settings);
            const dailyFolder = settings.useDailyNotesAsDefault ? resolver.getDailyNoteFolder() : null;
            const groups = buildTimelineSourceGroups(
                settings.timeline.sourceFolders,
                dailyFolder,
                settings.inbox.contextSources,
            );
            const target = this.app.vault.getAbstractFileByPath(file.value);
            const properties = isTFile(target)
                ? (this.app.metadataCache.getFileCache(target)?.frontmatter as Record<string, unknown> | undefined)
                : undefined;
            const status = assessTimelineTargetGroups(file.value, properties, groups);
            alignment.setText(status === "aligned" ? "Indexed by Focus Timeline" : "Outside Focus Timeline sources");
            alignment.toggleClass("is-warning", status !== "aligned");
        };
        updateAlignment();
        const heading = this.iconInput(
            container,
            "hash",
            "Save under heading",
            this.form.targetHeading,
            "Heading (optional)",
        ).input;
        this.registerSuggester(new FileSuggest(this.app, file));
        this.checkbox(container, "Insert at top", this.form.targetPosition === "start", (checked) => {
            this.form.targetPosition = checked ? "start" : "end";
        });
        this.registerDomEvent(file, "input", () => {
            this.form.targetFile = file.value;
            this.contextNotesController?.setTargetFile(file.value);
            updateAlignment();
        });
        this.registerDomEvent(heading, "input", () => (this.form.targetHeading = heading.value));
    }

    private setTitle(value: string): void {
        if (this.form.kind === "inbox") {
            this.form.inboxTitle = value;
            return;
        }
        this.form.title = value;
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
        placeholder?: string,
    ): HTMLInputElement {
        const input = container.createEl("input", {
            type,
            cls: "fn-mobile-event-input",
            attr: { "aria-label": label, ...(placeholder ? { placeholder } : {}) },
        });
        input.value = value;
        return input;
    }

    private iconInput(
        container: HTMLElement,
        icon: string,
        label: string,
        value: string,
        placeholder?: string,
    ): { wrapper: HTMLElement; icon: HTMLElement; input: HTMLInputElement } {
        const wrapper = container.createDiv({ cls: "fn-mobile-event-icon-input" });
        const iconEl = wrapper.createSpan({
            cls: "fn-mobile-event-input-icon",
            attr: { "aria-hidden": "true" },
        });
        setIcon(iconEl, icon);
        const input = this.input(wrapper, "text", label, value, placeholder);
        return { wrapper, icon: iconEl, input };
    }

    private checkbox(
        container: HTMLElement,
        label: string,
        initial: boolean,
        onChange: (checked: boolean) => void,
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
        onChange: (value: T) => void,
    ): void {
        const group = container.createDiv({ cls: "fn-mobile-event-segmented", attr: { role: "group" } });
        for (const option of options) {
            const button = group.createEl("button", {
                cls: `fn-mobile-event-segment${option.value === initial ? " is-active" : ""}`,
                text: option.label,
                attr: { type: "button", "aria-pressed": String(option.value === initial) },
            });
            this.registerDomEvent(button, "click", () => {
                group.querySelectorAll<HTMLElement>(".fn-mobile-event-segment").forEach((element) => {
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
        const root = this.rootEl;
        if (!root) return;
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
        this.registerDomEvent(window, "keydown", (event) => {
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
        if (this.resolved) return;
        if (this.pendingRecovery) {
            await this.retryRelatedLogs();
            return;
        }
        const settings = this.getSettings();
        const writer = new EventTaskWriter(this.app, settings.eventTask);
        if (this.form.kind === "inbox") {
            await this.executeSubmission(() =>
                submitInbox(this.form, {
                    writer,
                    resolveTarget: () => this.resolveInboxTarget(),
                    contextNotes: readContextSuggestionNotes(this.app),
                    contextSources: settings.inbox.contextSources,
                    resolveLinkDestination: createObsidianLinkResolver(this.app),
                }),
            );
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

        await this.executeSubmission(() =>
            submitEventTask(this.form, {
                writer,
                defaultHubNotesFolder: settings.eventTask.hubNotesFolder,
                defaultDetailNotesFolder: settings.eventTask.detailNotesFolder,
                resolveTargetFile: (record) => this.resolveTargetFile(record),
                findMarkdownFile: (path) => {
                    const file = this.app.vault.getAbstractFileByPath(path);
                    return isTFile(file) ? file : null;
                },
                openFile: (file) => {
                    const vaultFile = this.app.vault.getAbstractFileByPath(file.path);
                    if (isTFile(vaultFile))
                        void this.app.workspace.getLeaf(false).openFile(vaultFile, { active: false });
                },
                contextNotes: readContextSuggestionNotes(this.app),
                contextSources: settings.inbox.contextSources,
                resolveLinkDestination: createObsidianLinkResolver(this.app),
            }),
        );
    }

    private async executeSubmission(operation: () => Promise<EventTaskSubmissionResult>): Promise<void> {
        const attempt = this.submissionPolicy.run(operation);
        if (!attempt) return;

        this.setSubmissionBusy(true);
        try {
            this.finishSubmission(await attempt);
        } finally {
            this.setSubmissionBusy(false);
        }
    }

    private setSubmissionBusy(busy: boolean): void {
        if (!this.saveButtonEl) return;
        this.saveButtonEl.disabled = busy;
        this.saveButtonEl.setAttribute("aria-busy", String(busy));
        this.saveButtonEl.setText(busy ? "Saving…" : this.pendingRecovery ? "Retry related logs" : "Save");
    }

    private finishSubmission(result: EventTaskSubmissionResult): void {
        new Notice(result.message);
        if (result.status === "failure") return;
        if (!this.completionNotified) {
            this.completionNotified = true;
            this.onComplete();
        }
        if (result.status === "partial") {
            this.pendingRecovery = result;
            return;
        }
        this.pendingRecovery = null;
        this.resolved = true;
        this.close();
    }

    private async retryRelatedLogs(): Promise<void> {
        const recovery = this.pendingRecovery;
        if (!recovery || this.recoveryInFlight) return;
        this.recoveryInFlight = true;
        this.setSubmissionBusy(true);
        try {
            this.finishSubmission(await retryRelatedSubmission(recovery, new EventTaskWriter(this.app)));
        } catch (error) {
            new Notice(`Failed to retry related logs: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            this.recoveryInFlight = false;
            this.setSubmissionBusy(false);
        }
    }

    private resolveInboxTarget(): FocusTarget | null {
        return resolveInboxFormTarget(new TargetResolver(this.app, this.getSettings()), this.form);
    }

    private resolveTargetFile(record: EventTaskRecord): string {
        const when = record.kind === "event" ? record.start : (record.due ?? record.timebox?.start ?? this.anchorDate);
        const target: FocusTarget = {
            file: this.form.targetFile.trim(),
            heading: this.form.targetHeading.trim(),
            position: this.form.targetPosition,
        };
        return new TargetResolver(this.app, this.getSettings()).resolve(target, when).file;
    }
}
