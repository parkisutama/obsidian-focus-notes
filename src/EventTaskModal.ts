import { type App, type Component, Modal, Notice, Platform, setIcon } from "obsidian";
import { preferActiveNoteTarget } from "./CaptureTarget";
import { EventTaskFormState, type EventTaskKind, formatLocalDate } from "./EventTaskFormState";
import { EventTaskMobileScreen } from "./EventTaskMobileScreen";
import {
    type EventTaskSubmissionResult,
    type PartialSubmissionResult,
    retryRelatedSubmission,
    submitEventTask,
    submitInbox,
} from "./EventTaskSubmission";
import { type EventTaskRecord, EventTaskWriter } from "./EventTaskWriter";
import { InboxDesktopForm } from "./InboxDesktopForm";
import { ContextNotesController } from "./InboxNotesController";
import { resolveInboxFormTarget, selectInboxTarget } from "./InboxTarget";
import { shouldUseMobileForm } from "./MobileFormPolicy";
import { readContextSuggestionNotes } from "./ObsidianInboxSuggestionSource";
import { createObsidianLinkResolver } from "./ObsidianLinkResolver.ts";
import { ScheduledItemDesktopCreateModal } from "./ScheduledItemDesktopCreateModal.ts";
import { openMobileScheduledItemCreate } from "./ScheduledItemMobileCreateLauncher.ts";
import { SubmissionPolicy } from "./SubmissionPolicy";
import { FileSuggest, FolderSuggest } from "./Suggesters";
import { TargetResolver } from "./TargetResolver";
import { assessTimelineTargetGroups, buildTimelineSourceGroups } from "./TimelineSourceGroups";
import type { FocusNotesSettings, FocusTarget } from "./types";
import { isTFile } from "./utils";

export interface OpenEventTaskFormOptions {
    initialKind?: EventTaskKind;
    targetFile?: string;
}

export function openEventTaskForm(
    app: App,
    getSettings: () => FocusNotesSettings,
    anchorDate: Date = new Date(),
    onComplete: () => void = () => {},
    owner?: Component,
    options: OpenEventTaskFormOptions = {},
): void {
    if (shouldUseMobileForm(Platform.isMobile, window.innerWidth)) {
        if (options.initialKind === "task" || options.initialKind === "event") {
            openMobileScheduledItemCreate(
                app,
                getSettings,
                anchorDate,
                onComplete,
                options.initialKind,
                options.targetFile,
            );
            return;
        }
        new EventTaskMobileScreen(app, getSettings, anchorDate, onComplete, options).open(owner);
        return;
    }

    if (options.initialKind === "task" || options.initialKind === "event") {
        openDesktopScheduledItemCreate(
            app,
            getSettings,
            anchorDate,
            onComplete,
            options.initialKind,
            options.targetFile,
        );
        return;
    }

    new EventTaskModal(app, getSettings, anchorDate, onComplete, options).open();
}

export function openDesktopScheduledItemCreate(
    app: App,
    getSettings: () => FocusNotesSettings,
    anchorDate: Date,
    onComplete: () => void,
    kind: "task" | "event",
    targetFile?: string,
): void {
    const settings = getSettings();
    const resolver = new TargetResolver(app, settings);
    // Task never defaults to Daily Notes / the ambient active target — it should
    // attach to a specific Project or task-list note, chosen explicitly. An
    // active markdown note is still preferred below as a convenience default
    // (typically the project/list note the user is already working in); with
    // nothing active, the target stays empty and submit() blocks until the
    // user picks one, avoiding accidental duplication into Daily Notes.
    const configured: FocusTarget =
        kind === "task"
            ? { file: "", heading: settings.captureTask.heading, position: settings.captureTask.position }
            : (resolver.getPeriodicalTarget(settings.captureEvent.profileId, anchorDate) ?? {
                  file: "",
                  heading: settings.captureEvent.heading,
                  position: settings.captureEvent.position,
              });
    const activeFile = app.workspace.getActiveFile();
    const preferred = preferActiveNoteTarget(
        configured,
        targetFile ?? (activeFile?.extension === "md" ? activeFile.path : null),
    );
    new ScheduledItemDesktopCreateModal(
        app,
        getSettings,
        anchorDate,
        kind,
        {
            ...preferred,
            heading:
                kind === "task"
                    ? settings.captureTask.heading || preferred.heading
                    : settings.captureEvent.heading || preferred.heading,
        },
        onComplete,
    ).open();
}

export class EventTaskModal extends Modal {
    protected form: EventTaskFormState;

    protected resolved = false;
    private readonly submissionPolicy = new SubmissionPolicy();

    // ---- DOM refs -----------------------------------------------------------
    protected eventSectionEl!: HTMLElement;
    protected taskSectionEl!: HTMLElement;
    private eventTimeRowEl!: HTMLElement;
    private taskDueTimeEl!: HTMLInputElement;
    private taskTimeboxRowEl!: HTMLElement;
    private taskTimeboxDateEl!: HTMLInputElement;
    private taskTimeboxStartEl!: HTMLInputElement;
    private taskTimeboxEndEl!: HTMLInputElement;
    private saveButtonEl!: HTMLButtonElement;
    private remindersListEl!: HTMLElement;
    private detailNoteRowEl!: HTMLElement;
    private detailNoteInputEl!: HTMLInputElement;
    private titleInputEl!: HTMLInputElement;
    private eventTaskFieldsEl!: HTMLElement;
    private inboxSectionEl!: HTMLElement;
    private inboxForm: InboxDesktopForm | null = null;
    private contextNotesController: ContextNotesController | null = null;
    private pendingRecovery: PartialSubmissionResult | null = null;
    private recoveryInFlight = false;
    private completionNotified = false;
    constructor(
        app: App,
        private getSettings: () => FocusNotesSettings,
        private anchorDate: Date = new Date(),
        private onComplete: () => void = () => {},
        options: OpenEventTaskFormOptions = {},
    ) {
        super(app);

        const settings = getSettings();
        const resolver = new TargetResolver(app, settings);
        const configured: FocusTarget = resolver.getPeriodicalTarget(settings.captureEvent.profileId, anchorDate) ?? {
            file: "",
            heading: settings.captureEvent.heading,
            position: settings.captureEvent.position,
        };
        const activeFile = app.workspace.getActiveFile();
        const resolved = preferActiveNoteTarget(
            configured,
            options.targetFile ?? (activeFile?.extension === "md" ? activeFile.path : null),
        );
        const inboxTarget = selectInboxTarget({
            useEventCaptureTarget: settings.captureMoment.useEventCaptureTarget,
            eventTaskTarget: resolved,
            periodicalTarget: resolver.getPeriodicalTarget(settings.captureMoment.profileId, anchorDate),
            heading: settings.captureMoment.heading,
            position: settings.captureMoment.position,
        });
        this.form = new EventTaskFormState(anchorDate, {
            file: resolved.file,
            heading: settings.captureEvent.heading || resolved.heading,
            position: resolved.position,
            hubNotesFolder: settings.captureEvent.hubNotesFolder,
            detailNotesFolder: settings.eventTask.detailNotesFolder,
            inboxTargetFile: inboxTarget?.file ?? "",
            inboxHeading: inboxTarget?.heading ?? settings.captureMoment.heading,
            inboxPosition: inboxTarget?.position ?? settings.captureMoment.position,
        });
        this.form.kind = options.initialKind ?? "inbox";
    }

    onOpen(): void {
        this.modalEl.addClass("fn-gcal-modal");
        document.body.addClass("fn-event-task-modal-open");
        const { contentEl } = this;
        contentEl.empty();
        this.renderForm(contentEl);
    }

    onClose(): void {
        document.body.removeClass("fn-event-task-modal-open");
        this.inboxForm?.destroy();
        this.contextNotesController?.destroy();
        this.contextNotesController = null;
        this.inboxForm = null;
        this.contentEl.empty();
        if (!this.resolved) this.resolved = true;
    }

    protected renderForm(contentEl: HTMLElement): void {
        contentEl.addClass("fn-gcal-content");

        this.renderTitle(contentEl);
        this.renderTabs(contentEl);

        const body = contentEl.createDiv({ cls: "fn-gcal-body" });
        this.eventTaskFieldsEl = body.createDiv({
            cls: `fn-gcal-event-task-fields${this.form.kind === "inbox" ? " fn-gcal-hidden" : ""}`,
        });
        this.eventSectionEl = this.eventTaskFieldsEl.createDiv({ cls: "fn-gcal-tab-section" });
        this.eventSectionEl.toggleClass("fn-gcal-hidden", this.form.kind !== "event");
        this.taskSectionEl = this.eventTaskFieldsEl.createDiv({ cls: "fn-gcal-tab-section" });
        this.taskSectionEl.toggleClass("fn-gcal-hidden", this.form.kind !== "task");

        this.renderEventSection(this.eventSectionEl);
        this.renderTaskSection(this.taskSectionEl);
        this.renderDescription(this.eventTaskFieldsEl);
        this.renderDetailNote(this.eventTaskFieldsEl);
        this.renderSaveTo(this.eventTaskFieldsEl);

        this.inboxSectionEl = body.createDiv({ cls: "fn-gcal-tab-section" });
        this.inboxSectionEl.toggleClass("fn-gcal-hidden", this.form.kind !== "inbox");
        this.inboxForm = new InboxDesktopForm({
            app: this.app,
            form: this.form,
            getSettings: this.getSettings,
            resolveTarget: () => this.resolveInboxTarget(),
        });
        this.inboxForm.render(this.inboxSectionEl);
        this.renderButtons(contentEl);
    }

    // =========================================================================
    // Render helpers
    // =========================================================================

    protected renderTitle(container: HTMLElement): void {
        this.titleInputEl = container.createEl("input", {
            type: "text",
            cls: "fn-gcal-title-input",
            attr: { placeholder: "Add title", "aria-label": "Title" },
        });
        this.titleInputEl.value = this.form.getTitleForKind(this.form.kind);
        this.titleInputEl.addEventListener("input", () => {
            this.setTitleValue(this.titleInputEl.value);
        });
        this.titleInputEl.addEventListener("keydown", (evt) => {
            if (evt.key === "Enter" && !evt.shiftKey) {
                evt.preventDefault();
                void this.submit();
            }
        });
        window.setTimeout(() => this.titleInputEl.focus(), 50);
    }

    protected setTitleValue(value: string): void {
        this.form.setTitleForKind(this.form.kind, value);
    }

    protected renderTabs(container: HTMLElement): void {
        const tabs = container.createDiv({ cls: "fn-gcal-tabs" });
        const inboxBtn = tabs.createEl("button", {
            cls: `fn-gcal-tab${this.form.kind === "inbox" ? " fn-gcal-tab--active" : ""}`,
            text: "Moment",
            attr: { type: "button", "aria-pressed": String(this.form.kind === "inbox") },
        });
        const eventBtn = tabs.createEl("button", {
            cls: `fn-gcal-tab${this.form.kind === "event" ? " fn-gcal-tab--active" : ""}`,
            text: "Event",
            attr: { type: "button", "aria-pressed": String(this.form.kind === "event") },
        });
        const taskBtn = tabs.createEl("button", {
            cls: `fn-gcal-tab${this.form.kind === "task" ? " fn-gcal-tab--active" : ""}`,
            text: "Task",
            attr: { type: "button", "aria-pressed": String(this.form.kind === "task") },
        });

        const buttons = new Map<EventTaskKind, HTMLButtonElement>([
            ["inbox", inboxBtn],
            ["event", eventBtn],
            ["task", taskBtn],
        ]);
        const activate = (kind: EventTaskKind): void => {
            if (kind === "task" || kind === "event") {
                this.resolved = true;
                this.close();
                // Recompute fresh instead of forwarding this.form.targetFile: that
                // shared field only ever holds Event's Daily-Notes-derived default
                // (it's not kind-aware), which would otherwise leak into Task too.
                openDesktopScheduledItemCreate(this.app, this.getSettings, this.anchorDate, this.onComplete, kind);
                return;
            }
            this.form.kind = kind;
            this.titleInputEl.value = this.form.getTitleForKind(kind);
            for (const [value, button] of buttons) {
                const active = value === kind;
                button.toggleClass("fn-gcal-tab--active", active);
                button.setAttribute("aria-pressed", String(active));
            }
            this.eventTaskFieldsEl.addClass("fn-gcal-hidden");
            this.inboxSectionEl.removeClass("fn-gcal-hidden");
            this.eventSectionEl.addClass("fn-gcal-hidden");
            this.taskSectionEl.addClass("fn-gcal-hidden");
        };
        inboxBtn.addEventListener("click", () => activate("inbox"));
        eventBtn.addEventListener("click", () => activate("event"));
        taskBtn.addEventListener("click", () => activate("task"));
    }

    // ---- Inbox section -----------------------------------------------------

    private resolveInboxTarget(): FocusTarget | null {
        return resolveInboxFormTarget(new TargetResolver(this.app, this.getSettings()), this.form);
    }

    private resolveMomentBacklinkTarget(record: { capturedAt: Date }): FocusTarget | null {
        const settings = this.getSettings();
        const backlink = settings.captureMoment.backlink;
        if (!backlink.enabled) return null;
        const resolver = new TargetResolver(this.app, settings);
        // The "daily" Periodical Notes profile already syncs from the core
        // Daily Notes plugin when enabled and falls back to its own manual
        // fields otherwise (see TargetResolver.getPeriodicalTarget()).
        const target = resolver.getPeriodicalTarget(backlink.profileId, record.capturedAt);
        if (!target?.file.trim()) return null;
        return { ...target, heading: backlink.heading || "Moments", position: settings.captureMoment.position };
    }

    /** True when the Moment date is already carried by a dated per-period heading, so bullets skip repeating it. */
    private momentUsesDatedHeading(): boolean {
        const settings = this.getSettings();
        if (settings.captureMoment.useEventCaptureTarget) return false;
        const profile = settings.periodicalNotes.profiles.find(
            (candidate) => candidate.id === settings.captureMoment.profileId,
        );
        return Boolean(profile?.headingFormat);
    }

    // ---- Event section ------------------------------------------------------

    protected renderEventSection(container: HTMLElement): void {
        const content = this.makeRow(container, "calendar");
        const wrap = content.createDiv({ cls: "fn-gcal-datetime-wrap" });

        const mainRow = wrap.createDiv({ cls: "fn-gcal-datetime-row" });
        const dateEl = this.makeDateInput(mainRow, this.form.eventDate, "Event date");
        dateEl.addEventListener("change", () => (this.form.eventDate = dateEl.value));

        this.eventTimeRowEl = mainRow.createDiv({ cls: "fn-gcal-time-range" });
        const startEl = this.makeTimeInput(this.eventTimeRowEl, this.form.eventStartTime, "Start time");
        startEl.addEventListener("change", () => (this.form.eventStartTime = startEl.value));
        this.eventTimeRowEl.createSpan({ cls: "fn-gcal-time-sep", text: "—" });
        const endEl = this.makeTimeInput(this.eventTimeRowEl, this.form.eventEndTime, "End time");
        endEl.addEventListener("change", () => (this.form.eventEndTime = endEl.value));

        this.makeCheckboxRow(wrap, "All day", "fn-gcal-allday", (checked) => {
            this.form.eventAllDay = checked;
            this.eventTimeRowEl.toggleClass("fn-gcal-hidden", checked);
        });
        this.renderEventLifecycleSection(container);
    }

    protected renderEventLifecycleSection(container: HTMLElement): void {
        const statusContent = this.makeRow(container, "circle-dot");
        statusContent.createDiv({ cls: "fn-gcal-field-label", text: "Event status" });
        const status = statusContent.createEl("select", { attr: { "aria-label": "Event status" } });
        for (const [value, label] of [
            ["planned", "Planned"],
            ["completed", "Completed"],
            ["cancelled", "Cancelled"],
        ] as const) {
            status.createEl("option", { value, text: label });
        }
        status.value = this.form.eventStatus;

        const actualContent = this.makeRow(container, "clock-check");
        const actualWrap = actualContent.createDiv();
        let actualFields: HTMLElement;
        const actualToggle = this.makeCheckboxRow(
            actualWrap,
            "Record different actual time",
            "fn-gcal-event-actual-time",
            (checked) => {
                this.form.eventActualTimeEnabled = checked;
                actualFields.toggleClass("fn-gcal-hidden", !checked);
            },
        );
        actualFields = actualWrap.createDiv({ cls: "fn-gcal-datetime-row fn-gcal-hidden" });
        const actualStartDate = this.makeDateInput(actualFields, this.form.eventActualStartDate, "Actual start date");
        const actualStartTime = this.makeTimeInput(actualFields, this.form.eventActualStartTime, "Actual start time");
        const actualEndDate = this.makeDateInput(actualFields, this.form.eventActualEndDate, "Actual end date");
        const actualEndTime = this.makeTimeInput(actualFields, this.form.eventActualEndTime, "Actual end time");
        actualStartDate.addEventListener("change", () => (this.form.eventActualStartDate = actualStartDate.value));
        actualStartTime.addEventListener("change", () => (this.form.eventActualStartTime = actualStartTime.value));
        actualEndDate.addEventListener("change", () => (this.form.eventActualEndDate = actualEndDate.value));
        actualEndTime.addEventListener("change", () => (this.form.eventActualEndTime = actualEndTime.value));

        const syncStatus = (): void => {
            this.form.eventStatus = status.value as typeof this.form.eventStatus;
            const canRecordActual = this.form.eventStatus === "completed";
            actualContent.toggleClass("fn-gcal-hidden", !canRecordActual);
            if (!canRecordActual) {
                actualToggle.checked = false;
                this.form.eventActualTimeEnabled = false;
                actualFields.addClass("fn-gcal-hidden");
            }
        };
        status.addEventListener("change", syncStatus);
        syncStatus();
    }

    // ---- Task section -------------------------------------------------------

    protected renderTaskSection(container: HTMLElement): void {
        this.renderTaskPrioritySection(container);
        this.renderTaskDueSection(container);
        this.renderTaskTimeboxSection(container);
        this.renderTaskRemindersSection(container);
    }

    protected renderTaskPrioritySection(container: HTMLElement): void {
        const content = this.makeRow(container, "signal");
        content.createDiv({ cls: "fn-gcal-field-label", text: "Priority" });
        const select = content.createEl("select", { attr: { "aria-label": "Task priority" } });
        for (const [value, label] of [
            ["normal", "Normal"],
            ["low", "Low"],
            ["medium", "Medium"],
            ["high", "High"],
        ] as const) {
            select.createEl("option", { value, text: label });
        }
        select.value = this.form.taskPriority;
        select.addEventListener("change", () => {
            this.form.taskPriority = select.value as typeof this.form.taskPriority;
        });
    }

    protected renderTaskDueSection(container: HTMLElement): void {
        const dueContent = this.makeRow(container, "calendar");
        const dueWrap = dueContent.createDiv();
        dueWrap.createDiv({ cls: "fn-gcal-field-label", text: "Due date (optional)" });

        const dueDateRow = dueWrap.createDiv({ cls: "fn-gcal-datetime-row" });
        const dueDateEl = this.makeDateInput(dueDateRow, this.form.taskDueDate, "Due date");
        dueDateEl.addEventListener("change", () => (this.form.taskDueDate = dueDateEl.value));

        this.taskDueTimeEl = this.makeTimeInput(dueDateRow, this.form.taskDueTime, "Due time");
        this.taskDueTimeEl.addClass("fn-gcal-hidden");
        this.taskDueTimeEl.addEventListener("change", () => (this.form.taskDueTime = this.taskDueTimeEl.value));

        this.makeCheckboxRow(dueWrap, "Include time", "fn-gcal-due-time", (checked) => {
            this.form.taskDueHasTime = checked;
            this.taskDueTimeEl.toggleClass("fn-gcal-hidden", !checked);
        });
    }

    protected renderTaskTimeboxSection(container: HTMLElement): void {
        const timeboxContent = this.makeRow(container, "timer");
        const timeboxWrap = timeboxContent.createDiv();
        this.makeCheckboxRow(timeboxWrap, "Timebox (start – end)", "fn-gcal-timebox", (checked) => {
            this.form.taskTimeboxEnabled = checked;
            this.taskTimeboxRowEl.toggleClass("fn-gcal-hidden", !checked);
        });
        this.taskTimeboxRowEl = timeboxWrap.createDiv({ cls: "fn-gcal-datetime-row fn-gcal-hidden" });
        this.taskTimeboxDateEl = this.makeDateInput(this.taskTimeboxRowEl, this.form.taskTimeboxDate, "Timebox date");
        this.taskTimeboxDateEl.addEventListener(
            "change",
            () => (this.form.taskTimeboxDate = this.taskTimeboxDateEl.value),
        );
        this.taskTimeboxStartEl = this.makeTimeInput(
            this.taskTimeboxRowEl,
            this.form.taskTimeboxStartTime,
            "Timebox start time",
        );
        this.taskTimeboxStartEl.addEventListener(
            "change",
            () => (this.form.taskTimeboxStartTime = this.taskTimeboxStartEl.value),
        );
        this.taskTimeboxRowEl.createSpan({ cls: "fn-gcal-time-sep", text: "—" });
        this.taskTimeboxEndEl = this.makeTimeInput(
            this.taskTimeboxRowEl,
            this.form.taskTimeboxEndTime,
            "Timebox end time",
        );
        this.taskTimeboxEndEl.addEventListener(
            "change",
            () => (this.form.taskTimeboxEndTime = this.taskTimeboxEndEl.value),
        );
    }

    protected renderTaskRemindersSection(container: HTMLElement): void {
        const remindContent = this.makeRow(container, "bell");
        const remindWrap = remindContent.createDiv();
        remindWrap.createDiv({ cls: "fn-gcal-field-label", text: "Reminders" });

        this.remindersListEl = remindWrap.createDiv({ cls: "fn-gcal-reminders-list" });

        const addRemindBtn = remindWrap.createEl("button", {
            cls: "fn-gcal-add-remind-btn",
            text: "+ Add reminder",
            attr: { type: "button" },
        });
        addRemindBtn.addEventListener("click", (evt) => {
            evt.preventDefault();
            this.addReminderRow(formatLocalDate(this.anchorDate), "09:00");
        });
    }

    protected addReminderRow(date: string, time: string): void {
        const idx = this.form.reminders.length;
        this.form.reminders.push({ date, time });

        const row = this.remindersListEl.createDiv({ cls: "fn-gcal-reminder-row" });
        const dateEl = this.makeDateInput(row, date, "Reminder date");
        dateEl.addEventListener("change", () => (this.form.reminders[idx].date = dateEl.value));
        const timeEl = this.makeTimeInput(row, time, "Reminder time");
        timeEl.addEventListener("change", () => (this.form.reminders[idx].time = timeEl.value));

        const delBtn = row.createEl("button", {
            cls: "fn-gcal-remind-del-btn",
            attr: { type: "button", "aria-label": "Remove reminder" },
        });
        setIcon(delBtn, "x");
        delBtn.addEventListener("click", (evt) => {
            evt.preventDefault();
            row.remove();
            // Mark as deleted by clearing date
            this.form.reminders[idx].date = "";
        });
    }

    // ---- Description --------------------------------------------------------

    protected renderDescription(container: HTMLElement): void {
        const content = this.makeRow(container, "align-left");
        const editor = content.createDiv({
            cls: "fn-gcal-desc-input",
            attr: {
                "data-placeholder": "Add description. Use @ for contextual notes, # for tags.",
                "aria-label": "Description",
            },
        });
        this.contextNotesController = new ContextNotesController(this.app, editor, {
            initialValue: this.form.description,
            targetFile: this.form.targetFile,
            getContextSources: () => this.getSettings().inbox.contextSources,
            onChange: (value) => (this.form.description = value),
            referenceFormat: "object-reference",
        });
    }

    // ---- Detail note --------------------------------------------------------

    protected renderDetailNote(container: HTMLElement): void {
        const content = this.makeRow(container, "file-text");
        const wrap = content.createDiv({ cls: "fn-gcal-detail-wrap" });
        wrap.createDiv({ cls: "fn-gcal-field-label", text: "Detail note" });

        this.makeCheckboxRow(wrap, "Create a detail note for this event / task", "fn-gcal-detail-note", (checked) => {
            this.form.detailNoteEnabled = checked;
            this.detailNoteRowEl.toggleClass("fn-gcal-hidden", !checked);
            if (checked && !this.detailNoteInputEl.value) {
                this.detailNoteInputEl.value = this.form.title;
                this.form.detailNoteName = this.form.title;
            }
        });

        this.detailNoteRowEl = wrap.createDiv({ cls: "fn-gcal-saveto-fields fn-gcal-hidden" });

        this.detailNoteInputEl = this.detailNoteRowEl.createEl("input", {
            type: "text",
            cls: "fn-gcal-saveto-heading",
            attr: { placeholder: "Detail note name...", "aria-label": "Detail note name" },
        });
        this.detailNoteInputEl.addEventListener("input", () => {
            this.form.detailNoteName = this.detailNoteInputEl.value;
        });

        const folderEl = this.detailNoteRowEl.createEl("input", {
            type: "text",
            cls: "fn-gcal-saveto-file",
            attr: {
                placeholder: "Folder (e.g. Notes/Events)",
                "aria-label": "Detail note folder",
            },
        });
        folderEl.value = this.form.detailNoteFolder;
        folderEl.addEventListener("input", () => {
            this.form.detailNoteFolder = folderEl.value;
        });
        new FolderSuggest(this.app, folderEl);
    }

    // ---- Save to ------------------------------------------------------------

    protected renderSaveTo(container: HTMLElement): void {
        const content = this.makeRow(container, "folder");
        const wrap = content.createDiv({ cls: "fn-gcal-saveto-wrap" });
        wrap.createDiv({ cls: "fn-gcal-field-label", text: "Save to" });

        const fields = wrap.createDiv({ cls: "fn-gcal-saveto-fields" });
        const fileEl = fields.createEl("input", {
            type: "text",
            cls: "fn-gcal-saveto-file",
            attr: { placeholder: "Journal/2026-05-27.md", "aria-label": "Save to file" },
        });
        fileEl.value = this.form.targetFile;
        const alignment = wrap.createDiv({ cls: "fn-capture-timeline-alignment" });
        const updateAlignment = (): void => {
            const settings = this.getSettings();
            const resolver = new TargetResolver(this.app, settings);
            const dailyFolder = resolver.getProfileFolder("daily");
            const groups = buildTimelineSourceGroups(
                settings.timeline.sourceFolders,
                dailyFolder,
                settings.inbox.contextSources,
            );
            const target = this.app.vault.getAbstractFileByPath(fileEl.value);
            const properties = isTFile(target)
                ? (this.app.metadataCache.getFileCache(target)?.frontmatter as Record<string, unknown> | undefined)
                : undefined;
            const status = assessTimelineTargetGroups(fileEl.value, properties, groups);
            alignment.setText(status === "aligned" ? "Indexed by Focus Timeline" : "Outside Focus Timeline sources");
            alignment.toggleClass("is-warning", status !== "aligned");
        };
        updateAlignment();
        fileEl.addEventListener("input", () => {
            this.form.targetFile = fileEl.value;
            this.contextNotesController?.setTargetFile(fileEl.value);
            updateAlignment();
        });
        new FileSuggest(this.app, fileEl);

        const headingEl = fields.createEl("input", {
            type: "text",
            cls: "fn-gcal-saveto-heading",
            attr: { placeholder: "Heading (optional)", "aria-label": "Save under heading" },
        });
        headingEl.value = this.form.targetHeading;
        headingEl.addEventListener("input", () => (this.form.targetHeading = headingEl.value));

        this.makeCheckboxRow(
            wrap,
            "Insert at top (not bottom)",
            "fn-gcal-pos-start",
            (checked) => {
                this.form.targetPosition = checked ? "start" : "end";
            },
            this.form.targetPosition === "start",
        );
    }

    protected getTargetFileSummary(): string {
        return this.form.targetFile || "No destination selected";
    }

    // ---- Buttons ------------------------------------------------------------

    protected renderButtons(container: HTMLElement): void {
        const footer = container.createDiv({ cls: "fn-gcal-footer" });
        const discard = footer.createEl("button", {
            cls: "fn-gcal-btn-discard",
            text: "Cancel",
            attr: { type: "button" },
        });
        discard.addEventListener("click", () => {
            if (this.resolved) return;
            this.resolved = true;
            this.close();
        });
        const save = footer.createEl("button", {
            cls: "fn-gcal-btn-save mod-cta",
            text: "Save",
            attr: { type: "button" },
        });
        this.saveButtonEl = save;
        save.addEventListener("click", () => void this.submit());
    }

    // =========================================================================
    // Save logic
    // =========================================================================

    protected async submit(): Promise<void> {
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
                    resolveDailyBacklinkTarget: (record) => this.resolveMomentBacklinkTarget(record),
                    usesDatedHeading: this.momentUsesDatedHeading(),
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
                defaultHubNotesFolder: settings.captureEvent.hubNotesFolder,
                defaultDetailNotesFolder: settings.eventTask.detailNotesFolder,
                resolveTargetFile: (record) => this.resolveTargetFile(record),
                findMarkdownFile: (path) => {
                    const file = this.app.vault.getAbstractFileByPath(path);
                    return isTFile(file) ? file : null;
                },
                openFile: (file) => {
                    const vaultFile = this.app.vault.getAbstractFileByPath(file.path);
                    if (isTFile(vaultFile)) {
                        void this.app.workspace.getLeaf(false).openFile(vaultFile, { active: false });
                    }
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

    protected resolveTargetFile(record: EventTaskRecord): string {
        const when = record.kind === "event" ? record.start : (record.due ?? record.timebox?.start ?? this.anchorDate);
        const target: FocusTarget = {
            file: this.form.targetFile.trim(),
            heading: this.form.targetHeading.trim(),
            position: this.form.targetPosition,
        };
        return new TargetResolver(this.app, this.getSettings()).resolve(target, when).file;
    }

    // =========================================================================
    // Small DOM helpers
    // =========================================================================

    protected makeChipGroup<T extends string>(
        container: HTMLElement,
        options: Array<{ value: T; label: string }>,
        initial: T,
        onChange: (value: T) => void,
    ): void {
        const group = container.createDiv({ cls: "fn-chip-group", attr: { role: "group" } });
        options.forEach(({ value, label }) => {
            const btn = group.createEl("button", {
                cls: `fn-chip-option${value === initial ? " fn-chip-option--active" : ""}`,
                attr: { type: "button", "aria-pressed": String(value === initial) },
            });
            btn.textContent = label;
            btn.addEventListener("click", () => {
                group.querySelectorAll<HTMLElement>(".fn-chip-option").forEach((el) => {
                    el.removeClass("fn-chip-option--active");
                    el.setAttribute("aria-pressed", "false");
                });
                btn.addClass("fn-chip-option--active");
                btn.setAttribute("aria-pressed", "true");
                onChange(value);
            });
        });
    }

    protected makeRow(container: HTMLElement, icon: string): HTMLElement {
        const row = container.createDiv({ cls: "fn-gcal-row" });
        const iconEl = row.createDiv({ cls: "fn-gcal-row-icon" });
        setIcon(iconEl, icon);
        return row.createDiv({ cls: "fn-gcal-row-content" });
    }

    protected makeDateInput(container: HTMLElement, value: string, label = "Date"): HTMLInputElement {
        const el = container.createEl("input", {
            type: "date",
            cls: "fn-gcal-date-input",
            attr: { "aria-label": label },
        });
        el.value = value;
        return el;
    }

    protected makeTimeInput(container: HTMLElement, value: string, label = "Time"): HTMLInputElement {
        const el = container.createEl("input", {
            type: "time",
            cls: "fn-gcal-time-input",
            attr: { "aria-label": label },
        });
        el.value = value;
        return el;
    }

    protected makeCheckboxRow(
        container: HTMLElement,
        label: string,
        id: string,
        onChange: (checked: boolean) => void,
        initial = false,
    ): HTMLInputElement {
        const row = container.createDiv({ cls: "fn-gcal-allday-row" });
        const cb = row.createEl("input", { type: "checkbox", cls: "fn-gcal-checkbox", attr: { id } });
        cb.checked = initial;
        row.createEl("label", { text: label, attr: { for: id } });
        cb.addEventListener("change", () => onChange(cb.checked));
        return cb;
    }
}
