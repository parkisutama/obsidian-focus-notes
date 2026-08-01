import {
    App,
    FuzzySuggestModal,
    Modal,
    Notice,
    Platform,
    TFile,
    setIcon
} from "obsidian";
import { FocusNotesSettings, FocusTarget, InsertPosition } from "./types";
import { EventTaskRecord, EventTaskWriter } from "./EventTaskWriter";
import { EventTaskFormState, EventTaskKind, HubMode, formatLocalDate } from "./EventTaskFormState";
import { submitEventTask } from "./EventTaskSubmission";
import { FileSuggest, FolderSuggest } from "./Suggesters";
import { TargetResolver } from "./TargetResolver";
import { isTFile } from "./utils";
import { shouldUseMobileForm } from "./MobileFormPolicy";

export function openEventTaskForm(
    app: App,
    getSettings: () => FocusNotesSettings,
    saveSettings: () => Promise<void>,
    anchorDate: Date = new Date(),
    onComplete: () => void = () => {}
): void {
    if (shouldUseMobileForm(Platform.isMobile, window.innerWidth)) {
        new EventTaskMobileSheet(app, getSettings, saveSettings, anchorDate, onComplete).open();
        return;
    }

    new EventTaskModal(app, getSettings, saveSettings, anchorDate, onComplete).open();
}

export class EventTaskModal extends Modal {
    protected form: EventTaskFormState;

    protected resolved = false;

    // ---- DOM refs -----------------------------------------------------------
    private hubInputEl!: HTMLInputElement;
    private hubAlsoRowEl!: HTMLElement;
    private writeToHubCb!: HTMLInputElement;
    protected eventSectionEl!: HTMLElement;
    protected taskSectionEl!: HTMLElement;
    private eventTimeRowEl!: HTMLElement;
    private taskDueTimeEl!: HTMLInputElement;
    private taskTimeboxRowEl!: HTMLElement;
    private taskTimeboxDateEl!: HTMLInputElement;
    private taskTimeboxStartEl!: HTMLInputElement;
    private taskTimeboxEndEl!: HTMLInputElement;
    private remindersListEl!: HTMLElement;
    private detailNoteRowEl!: HTMLElement;
    private detailNoteInputEl!: HTMLInputElement;
    protected cleanupMobileViewportSupport: (() => void) | null = null;

    constructor(
        app: App,
        private getSettings: () => FocusNotesSettings,
        private saveSettings: () => Promise<void>,
        private anchorDate: Date = new Date(),
        private onComplete: () => void = () => {}
    ) {
        super(app);

        const settings = getSettings();
        const resolver = new TargetResolver(app, settings);
        const resolved = resolver.resolve(resolver.getActiveTarget(), anchorDate);
        this.form = new EventTaskFormState(anchorDate, {
            file: resolved.file,
            heading: settings.eventTask.defaultSaveHeading || resolved.heading,
            position: resolved.position,
            hubNotesFolder: settings.eventTask.hubNotesFolder,
            detailNotesFolder: settings.eventTask.detailNotesFolder
        });
    }

    onOpen(): void {
        this.modalEl.addClass("fn-gcal-modal");
        const { contentEl } = this;
        contentEl.empty();
        this.renderForm(contentEl, this.modalEl);
    }

    onClose(): void {
        this.cleanupMobileViewportSupport?.();
        this.cleanupMobileViewportSupport = null;
        this.contentEl.empty();
        if (!this.resolved) this.resolved = true;
    }

    protected renderForm(contentEl: HTMLElement, viewportVariableTarget: HTMLElement): void {
        contentEl.addClass("fn-gcal-content");

        this.renderTitle(contentEl);
        this.renderTabs(contentEl);

        const body = contentEl.createDiv({ cls: "fn-gcal-body" });
        this.eventSectionEl = body.createDiv({ cls: "fn-gcal-tab-section" });
        this.taskSectionEl = body.createDiv({ cls: "fn-gcal-tab-section fn-gcal-hidden" });

        this.renderEventSection(this.eventSectionEl);
        this.renderTaskSection(this.taskSectionEl);
        this.renderDescription(body);
        this.renderHubNote(body);
        this.renderDetailNote(body);
        this.renderSaveTo(body);
        this.renderButtons(contentEl);
        this.setupMobileViewportSupport(contentEl, viewportVariableTarget);
    }

    // =========================================================================
    // Render helpers
    // =========================================================================

    protected renderTitle(container: HTMLElement): void {
        const titleInput = container.createEl("input", {
            type: "text",
            cls: "fn-gcal-title-input",
            attr: { placeholder: "Add title", "aria-label": "Title" }
        });
        titleInput.addEventListener("input", () => {
            this.setTitleValue(titleInput.value);
        });
        titleInput.addEventListener("keydown", evt => {
            if (evt.key === "Enter" && !evt.shiftKey) {
                evt.preventDefault();
                void this.submit();
            }
        });
        window.setTimeout(() => titleInput.focus(), 50);
    }

    protected setTitleValue(value: string): void {
        this.form.title = value;
        // Sync hub note name only while still at default
        if (this.form.hubMode === "create" && this.hubInputEl) {
            if (!this.hubInputEl.value || this.hubInputEl.value === this.form.hubCreateName) {
                this.hubInputEl.value = this.form.title;
                this.form.hubCreateName = this.form.title;
            }
        }
    }

    protected renderTabs(container: HTMLElement): void {
        const tabs = container.createDiv({ cls: "fn-gcal-tabs" });
        const eventBtn = tabs.createEl("button", {
            cls: "fn-gcal-tab fn-gcal-tab--active",
            text: "Event",
            attr: { type: "button" }
        });
        const taskBtn = tabs.createEl("button", {
            cls: "fn-gcal-tab",
            text: "Task",
            attr: { type: "button" }
        });

        eventBtn.addEventListener("click", () => {
            this.form.kind = "event";
            eventBtn.addClass("fn-gcal-tab--active");
            taskBtn.removeClass("fn-gcal-tab--active");
            this.eventSectionEl.removeClass("fn-gcal-hidden");
            this.taskSectionEl.addClass("fn-gcal-hidden");
        });
        taskBtn.addEventListener("click", () => {
            this.form.kind = "task";
            taskBtn.addClass("fn-gcal-tab--active");
            eventBtn.removeClass("fn-gcal-tab--active");
            this.taskSectionEl.removeClass("fn-gcal-hidden");
            this.eventSectionEl.addClass("fn-gcal-hidden");
        });
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

        this.makeCheckboxRow(wrap, "All day", "fn-gcal-allday", checked => {
            this.form.eventAllDay = checked;
            this.eventTimeRowEl.toggleClass("fn-gcal-hidden", checked);
        });
    }

    // ---- Task section -------------------------------------------------------

    protected renderTaskSection(container: HTMLElement): void {
        this.renderTaskDueSection(container);
        this.renderTaskTimeboxSection(container);
        this.renderTaskRemindersSection(container);
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

        this.makeCheckboxRow(dueWrap, "Include time", "fn-gcal-due-time", checked => {
            this.form.taskDueHasTime = checked;
            this.taskDueTimeEl.toggleClass("fn-gcal-hidden", !checked);
        });
    }

    protected renderTaskTimeboxSection(container: HTMLElement): void {
        const timeboxContent = this.makeRow(container, "timer");
        const timeboxWrap = timeboxContent.createDiv();
        this.makeCheckboxRow(timeboxWrap, "Timebox (start – end)", "fn-gcal-timebox", checked => {
            this.form.taskTimeboxEnabled = checked;
            this.taskTimeboxRowEl.toggleClass("fn-gcal-hidden", !checked);
        });
        this.taskTimeboxRowEl = timeboxWrap.createDiv({ cls: "fn-gcal-datetime-row fn-gcal-hidden" });
        this.taskTimeboxDateEl = this.makeDateInput(this.taskTimeboxRowEl, this.form.taskTimeboxDate, "Timebox date");
        this.taskTimeboxDateEl.addEventListener("change", () => (this.form.taskTimeboxDate = this.taskTimeboxDateEl.value));
        this.taskTimeboxStartEl = this.makeTimeInput(this.taskTimeboxRowEl, this.form.taskTimeboxStartTime, "Timebox start time");
        this.taskTimeboxStartEl.addEventListener("change", () => (this.form.taskTimeboxStartTime = this.taskTimeboxStartEl.value));
        this.taskTimeboxRowEl.createSpan({ cls: "fn-gcal-time-sep", text: "—" });
        this.taskTimeboxEndEl = this.makeTimeInput(this.taskTimeboxRowEl, this.form.taskTimeboxEndTime, "Timebox end time");
        this.taskTimeboxEndEl.addEventListener("change", () => (this.form.taskTimeboxEndTime = this.taskTimeboxEndEl.value));
    }

    protected renderTaskRemindersSection(container: HTMLElement): void {
        const remindContent = this.makeRow(container, "bell");
        const remindWrap = remindContent.createDiv();
        remindWrap.createDiv({ cls: "fn-gcal-field-label", text: "Reminders" });

        this.remindersListEl = remindWrap.createDiv({ cls: "fn-gcal-reminders-list" });

        const addRemindBtn = remindWrap.createEl("button", {
            cls: "fn-gcal-add-remind-btn",
            text: "+ Add reminder",
            attr: { type: "button" }
        });
        addRemindBtn.addEventListener("click", evt => {
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
            attr: { type: "button", "aria-label": "Remove reminder" }
        });
        setIcon(delBtn, "x");
        delBtn.addEventListener("click", evt => {
            evt.preventDefault();
            row.remove();
            // Mark as deleted by clearing date
            this.form.reminders[idx].date = "";
        });
    }

    // ---- Description --------------------------------------------------------

    protected renderDescription(container: HTMLElement): void {
        const content = this.makeRow(container, "align-left");
        const textarea = content.createEl("textarea", {
            cls: "fn-gcal-desc-input",
            attr: { placeholder: "Add description or attachment...", "aria-label": "Description" }
        });
        textarea.rows = 3;
        textarea.addEventListener("input", () => (this.form.description = textarea.value));
    }

    // ---- Hub note -----------------------------------------------------------

    protected renderHubNote(container: HTMLElement): void {
        const content = this.makeRow(container, "link");
        const wrap = content.createDiv({ cls: "fn-gcal-hub-wrap" });
        wrap.createDiv({ cls: "fn-gcal-field-label", text: "Related note" });

        // Input row (created first so it's available in radio closures)
        const hubInputRow = wrap.createDiv({ cls: "fn-gcal-hub-input-row fn-gcal-hidden" });
        this.hubInputEl = hubInputRow.createEl("input", {
            type: "text",
            cls: "fn-gcal-hub-input",
            attr: { placeholder: "Search notes...", "aria-label": "Related note" }
        });
        this.hubInputEl.addEventListener("input", () => {
            if (this.form.hubMode === "link") this.form.hubLinkPath = this.hubInputEl.value;
            else this.form.hubCreateName = this.hubInputEl.value;
        });
        new FileSuggest(this.app, this.hubInputEl);

        const pickBtn = hubInputRow.createEl("button", {
            cls: "fn-gcal-hub-pick-btn",
            text: "Pick",
            attr: { type: "button" }
        });
        pickBtn.addEventListener("click", evt => {
            evt.preventDefault();
            new FilePickerSuggester(this.app, file => {
                this.hubInputEl.value = file.path;
                this.form.hubLinkPath = file.path;
            }).open();
        });

        const hubFolderRow = wrap.createDiv({
            cls: "fn-gcal-hub-input-row fn-gcal-hidden"
        });
        const hubFolderEl = hubFolderRow.createEl("input", {
            type: "text",
            cls: "fn-gcal-hub-input",
            attr: {
                placeholder: "Folder (e.g. Notes/Projects)",
                "aria-label": "Folder for new related note"
            }
        });
        hubFolderEl.value = this.form.hubCreateFolder;
        hubFolderEl.addEventListener("input", () => {
            this.form.hubCreateFolder = hubFolderEl.value;
        });
        new FolderSuggest(this.app, hubFolderEl);

        // "Also write to hub note" row — visible only when mode != none
        this.hubAlsoRowEl = wrap.createDiv({ cls: "fn-gcal-allday-row fn-gcal-hub-also fn-gcal-hidden" });
        this.writeToHubCb = this.hubAlsoRowEl.createEl("input", {
            type: "checkbox",
            cls: "fn-gcal-checkbox",
            attr: { id: "fn-gcal-also-hub" }
        });
        this.hubAlsoRowEl.createEl("label", {
            text: "Also write to related note (same heading)",
            attr: { for: "fn-gcal-also-hub" }
        });
        this.writeToHubCb.addEventListener("change", () => {
            this.form.writeToHubNote = this.writeToHubCb.checked;
        });

        // Chip selector for hub mode (replaces radio group)
        this.makeChipGroup<HubMode>(
            wrap,
            [
                { value: "none",   label: "None" },
                { value: "link",   label: "Link" },
                { value: "create", label: "New note" },
            ],
            this.form.hubMode,
            value => {
                this.form.hubMode = value;
                const showInput = value !== "none";
                hubInputRow.toggleClass("fn-gcal-hidden", !showInput);
                hubFolderRow.toggleClass("fn-gcal-hidden", value !== "create");
                pickBtn.toggleClass("fn-gcal-hidden", value === "create");
                this.hubAlsoRowEl.toggleClass("fn-gcal-hidden", !showInput);
                this.hubInputEl.placeholder = value === "link" ? "Search notes..." : "New note name";
                this.hubInputEl.setAttribute(
                    "aria-label",
                    value === "link" ? "Related note" : "New related note name"
                );
                if (value === "create") {
                    this.hubInputEl.value = this.form.title;
                    this.form.hubCreateName = this.form.title;
                } else {
                    this.hubInputEl.value = "";
                    this.form.hubLinkPath = "";
                }
            }
        );
        // Move chip group before hubInputRow (chip group was appended last)
        wrap.insertBefore(wrap.lastElementChild!, hubInputRow);
    }

    // ---- Detail note --------------------------------------------------------

    protected renderDetailNote(container: HTMLElement): void {
        const content = this.makeRow(container, "file-text");
        const wrap = content.createDiv({ cls: "fn-gcal-detail-wrap" });
        wrap.createDiv({ cls: "fn-gcal-field-label", text: "Detail note" });

        this.makeCheckboxRow(wrap, "Create a detail note for this event / task", "fn-gcal-detail-note", checked => {
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
            attr: { placeholder: "Detail note name...", "aria-label": "Detail note name" }
        });
        this.detailNoteInputEl.addEventListener("input", () => {
            this.form.detailNoteName = this.detailNoteInputEl.value;
        });

        const folderEl = this.detailNoteRowEl.createEl("input", {
            type: "text",
            cls: "fn-gcal-saveto-file",
            attr: {
                placeholder: "Folder (e.g. Notes/Events)",
                "aria-label": "Detail note folder"
            }
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
            attr: { placeholder: "Journal/2026-05-27.md", "aria-label": "Save to file" }
        });
        fileEl.value = this.form.targetFile;
        fileEl.addEventListener("input", () => (this.form.targetFile = fileEl.value));
        new FileSuggest(this.app, fileEl);

        const headingEl = fields.createEl("input", {
            type: "text",
            cls: "fn-gcal-saveto-heading",
            attr: { placeholder: "Heading (optional)", "aria-label": "Save under heading" }
        });
        headingEl.value = this.form.targetHeading;
        headingEl.addEventListener("input", () => (this.form.targetHeading = headingEl.value));

        this.makeCheckboxRow(wrap, "Insert at top (not bottom)", "fn-gcal-pos-start", checked => {
            this.form.targetPosition = checked ? "start" : "end";
        }, this.form.targetPosition === "start");
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
            attr: { type: "button" }
        });
        discard.addEventListener("click", () => {
            if (this.resolved) return;
            this.resolved = true;
            this.close();
        });
        const save = footer.createEl("button", {
            cls: "fn-gcal-btn-save mod-cta",
            text: "Save",
            attr: { type: "button" }
        });
        save.addEventListener("click", () => void this.submit());
    }

    // =========================================================================
    // Save logic
    // =========================================================================

    protected async submit(): Promise<void> {
        if (this.resolved) return;

        if (!this.form.title.trim()) {
            new Notice("Please enter a title.");
            return;
        }
        if (!this.form.targetFile.trim()) {
            new Notice("Please select a target file.");
            return;
        }

        const settings = this.getSettings();
        const writer = new EventTaskWriter(this.app, settings.eventTask);
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
                if (isTFile(vaultFile)) {
                    void this.app.workspace.getLeaf(false).openFile(vaultFile, { active: false });
                }
            }
        });

        new Notice(result.message);
        if (result.ok) {
            this.resolved = true;
            this.onComplete();
            this.close();
        }
    }

    protected resolveTargetFile(record: EventTaskRecord): string {
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

    // =========================================================================
    // Small DOM helpers
    // =========================================================================

    protected makeChipGroup<T extends string>(
        container: HTMLElement,
        options: Array<{ value: T; label: string }>,
        initial: T,
        onChange: (value: T) => void
    ): void {
        const group = container.createDiv({ cls: "fn-chip-group", attr: { role: "group" } });
        options.forEach(({ value, label }) => {
            const btn = group.createEl("button", {
                cls: "fn-chip-option" + (value === initial ? " fn-chip-option--active" : ""),
                attr: { type: "button", "aria-pressed": String(value === initial) }
            });
            btn.textContent = label;
            btn.addEventListener("click", () => {
                group.querySelectorAll<HTMLElement>(".fn-chip-option")
                    .forEach(el => {
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
            attr: { "aria-label": label }
        });
        el.value = value;
        return el;
    }

    protected makeTimeInput(container: HTMLElement, value: string, label = "Time"): HTMLInputElement {
        const el = container.createEl("input", {
            type: "time",
            cls: "fn-gcal-time-input",
            attr: { "aria-label": label }
        });
        el.value = value;
        return el;
    }

    protected makeCheckboxRow(
        container: HTMLElement,
        label: string,
        id: string,
        onChange: (checked: boolean) => void,
        initial = false
    ): HTMLInputElement {
        const row = container.createDiv({ cls: "fn-gcal-allday-row" });
        const cb = row.createEl("input", { type: "checkbox", cls: "fn-gcal-checkbox", attr: { id } });
        cb.checked = initial;
        row.createEl("label", { text: label, attr: { for: id } });
        cb.addEventListener("change", () => onChange(cb.checked));
        return cb;
    }

    protected setupMobileViewportSupport(rootEl: HTMLElement, variableTargetEl: HTMLElement): void {
        const viewport = window.visualViewport;
        const body = rootEl.querySelector<HTMLElement>(".fn-gcal-body");
        let focusInsideEditable = false;
        const isEditable = (el: Element | null): boolean => {
            return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
        };
        const updateHeight = (): void => {
            const height = viewport?.height ?? window.innerHeight;
            const offsetTop = viewport?.offsetTop ?? 0;
            const keyboardInset = viewport
                ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
                : 0;
            variableTargetEl.style.setProperty("--fn-gcal-viewport-height", `${Math.max(240, height)}px`);
            variableTargetEl.style.setProperty("--fn-gcal-viewport-top", `${Math.max(0, offsetTop)}px`);
            variableTargetEl.style.setProperty("--fn-gcal-keyboard-inset", `${keyboardInset}px`);
            variableTargetEl.toggleClass("fn-mobile-keyboard-open", focusInsideEditable || keyboardInset > 80);
        };
        const keepFocusedFieldVisible = (event?: Event): void => {
            const target = event?.target;
            const active = target instanceof HTMLElement ? target : document.activeElement;
            if (!body || !(active instanceof HTMLElement) || !rootEl.contains(active)) return;

            window.setTimeout(() => {
                const bodyRect = body.getBoundingClientRect();
                const activeRect = active.getBoundingClientRect();
                const bottomOverflow = activeRect.bottom - bodyRect.bottom + 72;
                const topOverflow = bodyRect.top - activeRect.top + 24;

                if (bottomOverflow > 0) {
                    body.scrollTop += bottomOverflow;
                } else if (topOverflow > 0) {
                    body.scrollTop -= topOverflow;
                }

                if (bottomOverflow > 0 || topOverflow > 0) {
                    active.scrollIntoView({ block: "center", inline: "nearest" });
                }
            }, 120);
        };
        const onFocusIn = (event: FocusEvent): void => {
            focusInsideEditable = isEditable(event.target instanceof Element ? event.target : null);
            updateHeight();
            keepFocusedFieldVisible(event);
        };
        const onFocusOut = (): void => {
            window.setTimeout(() => {
                focusInsideEditable = rootEl.contains(document.activeElement) && isEditable(document.activeElement);
                updateHeight();
            }, 80);
        };

        updateHeight();
        window.addEventListener("resize", updateHeight);
        rootEl.addEventListener("focusin", onFocusIn);
        rootEl.addEventListener("focusout", onFocusOut);
        viewport?.addEventListener("resize", updateHeight);
        viewport?.addEventListener("scroll", updateHeight);
        viewport?.addEventListener("resize", keepFocusedFieldVisible);
        viewport?.addEventListener("scroll", keepFocusedFieldVisible);

        this.cleanupMobileViewportSupport = () => {
            window.removeEventListener("resize", updateHeight);
            rootEl.removeEventListener("focusin", onFocusIn);
            rootEl.removeEventListener("focusout", onFocusOut);
            viewport?.removeEventListener("resize", updateHeight);
            viewport?.removeEventListener("scroll", updateHeight);
            viewport?.removeEventListener("resize", keepFocusedFieldVisible);
            viewport?.removeEventListener("scroll", keepFocusedFieldVisible);
            variableTargetEl.style.removeProperty("--fn-gcal-viewport-height");
            variableTargetEl.style.removeProperty("--fn-gcal-viewport-top");
            variableTargetEl.style.removeProperty("--fn-gcal-keyboard-inset");
            variableTargetEl.removeClass("fn-mobile-keyboard-open");
        };
    }

}

export class EventTaskMobileSheet extends EventTaskModal {
    private sheetEl: HTMLElement | null = null;
    private sheetContentEl: HTMLElement | null = null;
    private cleanupSheetEvents: (() => void) | null = null;
    private contextLabelEl: HTMLElement | null = null;
    private taskOptionsEl: HTMLElement | null = null;

    open(): void {
        if (this.sheetEl || document.querySelector(".fn-mobile-sheet")) return;

        const sheet = document.body.createDiv({ cls: "fn-mobile-sheet" });
        const content = sheet.createDiv({ cls: "fn-mobile-sheet-content" });
        this.sheetEl = sheet;
        this.sheetContentEl = content;
        document.body.addClass("fn-mobile-sheet-open");

        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.key !== "Escape" || this.resolved) return;
            event.preventDefault();
            this.resolved = true;
            this.close();
        };
        const dismissKeyboard = (): void => {
            const active = document.activeElement;
            if (active instanceof HTMLElement && sheet.contains(active)) {
                active.blur();
            }
            sheet.removeClass("fn-mobile-keyboard-open");
            sheet.style.setProperty("--fn-gcal-keyboard-inset", "0px");
        };
        const onPointerDown = (event: PointerEvent): void => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            // Tap directly on the backdrop (outside sheet content) → dismiss
            if (target === sheet && !this.resolved) {
                this.resolved = true;
                this.close();
                return;
            }
            const isEditableTarget =
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                target instanceof HTMLSelectElement ||
                Boolean(target.closest("input, textarea, select"));
            if (!isEditableTarget) dismissKeyboard();
        };
        window.addEventListener("keydown", onKeyDown);
        sheet.addEventListener("pointerdown", onPointerDown);
        this.cleanupSheetEvents = () => {
            window.removeEventListener("keydown", onKeyDown);
            sheet.removeEventListener("pointerdown", onPointerDown);
        };

        this.renderForm(content, sheet);
    }

    close(): void {
        this.cleanupMobileViewportSupport?.();
        this.cleanupMobileViewportSupport = null;
        this.cleanupSheetEvents?.();
        this.cleanupSheetEvents = null;
        this.sheetEl?.remove();
        this.sheetEl = null;
        this.sheetContentEl = null;
        this.contextLabelEl = null;
        this.taskOptionsEl = null;
        document.body.removeClass("fn-mobile-sheet-open");
        if (!this.resolved) this.resolved = true;
    }

    protected renderForm(contentEl: HTMLElement, viewportVariableTarget: HTMLElement): void {
        contentEl.addClass("fn-gcal-content");
        contentEl.addClass("fn-mobile-task-content");
        contentEl.createDiv({ cls: "fn-mobile-sheet-handle" });

        const topbar = contentEl.createDiv({ cls: "fn-mobile-task-topbar" });
        const closeButton = topbar.createEl("button", {
            cls: "fn-mobile-sheet-close",
            text: "Cancel",
            attr: { type: "button", "aria-label": "Cancel", title: "Cancel" }
        });
        closeButton.addEventListener("click", () => {
            if (this.resolved) return;
            this.resolved = true;
            this.close();
        });

        this.contextLabelEl = topbar.createDiv({
            cls: "fn-mobile-task-context",
            text: "New event",
            attr: { "aria-live": "polite" }
        });

        const saveButton = topbar.createEl("button", {
            cls: "fn-mobile-task-save mod-cta",
            text: "Save",
            attr: { type: "button" }
        });
        saveButton.addEventListener("click", () => void this.submit());

        const body = contentEl.createDiv({ cls: "fn-gcal-body fn-mobile-task-body" });
        this.renderTitle(body);
        this.renderTabs(body);

        this.eventSectionEl = body.createDiv({ cls: "fn-gcal-tab-section fn-mobile-primary-section" });
        this.taskSectionEl = body.createDiv({ cls: "fn-gcal-tab-section fn-mobile-primary-section fn-gcal-hidden" });
        this.renderEventSection(this.eventSectionEl);
        this.renderTaskDueSection(this.taskSectionEl);
        this.renderDescription(body);

        const advanced = body.createDiv({ cls: "fn-mobile-advanced-list" });
        this.renderMobileDisclosure(
            advanced,
            "More options",
            "sliders-horizontal",
            options => {
                this.taskOptionsEl = options.createDiv({ cls: "fn-mobile-task-options fn-gcal-hidden" });
                this.renderMobileDisclosure(
                    this.taskOptionsEl,
                    "Timebox",
                    "timer",
                    container => this.renderTaskTimeboxSection(container)
                );
                this.renderMobileDisclosure(
                    this.taskOptionsEl,
                    "Reminders",
                    "bell",
                    container => this.renderTaskRemindersSection(container)
                );
                this.renderMobileDisclosure(options, "Related note", "link", container => this.renderHubNote(container));
                this.renderMobileDisclosure(options, "Detail note", "file-text", container => this.renderDetailNote(container));
                this.renderMobileDisclosure(
                    options,
                    "Save to",
                    "folder",
                    container => this.renderSaveTo(container),
                    false,
                    () => this.getTargetFileSummary()
                );
            },
            false,
            () => "Notes, details, and destination"
        );

        this.setupMobileViewportSupport(contentEl, viewportVariableTarget);
    }

    protected renderTitle(container: HTMLElement): void {
        const titleInput = container.createEl("input", {
            type: "text",
            cls: "fn-gcal-title-input fn-mobile-title-input",
            attr: { placeholder: "Add title", "aria-label": "Title" }
        });
        titleInput.addEventListener("input", () => {
            this.setTitleValue(titleInput.value);
        });
        titleInput.addEventListener("keydown", evt => {
            if (evt.key === "Enter" && !evt.shiftKey) {
                evt.preventDefault();
                void this.submit();
            }
        });
    }

    protected renderTabs(container: HTMLElement): void {
        const tabs = container.createDiv({
            cls: "fn-gcal-tabs",
            attr: { role: "group", "aria-label": "Item type" }
        });
        const eventBtn = tabs.createEl("button", {
            cls: "fn-gcal-tab fn-gcal-tab--active",
            text: "Event",
            attr: { type: "button", "aria-pressed": "true" }
        });
        const taskBtn = tabs.createEl("button", {
            cls: "fn-gcal-tab",
            text: "Task",
            attr: { type: "button", "aria-pressed": "false" }
        });

        const activate = (kind: EventTaskKind): void => {
            this.form.kind = kind;
            const isEvent = kind === "event";
            eventBtn.toggleClass("fn-gcal-tab--active", isEvent);
            taskBtn.toggleClass("fn-gcal-tab--active", !isEvent);
            eventBtn.setAttribute("aria-pressed", String(isEvent));
            taskBtn.setAttribute("aria-pressed", String(!isEvent));
            this.eventSectionEl.toggleClass("fn-gcal-hidden", !isEvent);
            this.taskSectionEl.toggleClass("fn-gcal-hidden", isEvent);
            this.taskOptionsEl?.toggleClass("fn-gcal-hidden", isEvent);
            this.contextLabelEl?.setText(isEvent ? "New event" : "New task");
        };

        eventBtn.addEventListener("click", () => activate("event"));
        taskBtn.addEventListener("click", () => activate("task"));
    }

    protected makeCheckboxRow(
        container: HTMLElement,
        label: string,
        id: string,
        onChange: (checked: boolean) => void,
        initial = false
    ): HTMLInputElement {
        let checked = initial;
        const row = container.createEl("button", {
            cls: "fn-mobile-toggle-row" + (initial ? " fn-mobile-toggle-row--on" : ""),
            attr: { type: "button", "aria-pressed": String(initial) }
        });
        row.createSpan({ cls: "fn-mobile-toggle-label", text: label });
        const indicator = row.createSpan({ cls: "fn-mobile-toggle-indicator" });
        setIcon(indicator, initial ? "check-circle-2" : "circle");

        row.addEventListener("click", () => {
            checked = !checked;
            row.toggleClass("fn-mobile-toggle-row--on", checked);
            row.setAttribute("aria-pressed", String(checked));
            indicator.empty();
            setIcon(indicator, checked ? "check-circle-2" : "circle");
            dummy.checked = checked;
            onChange(checked);
        });

        // Hidden input untuk API compatibility (return type & id lookups)
        const dummy = container.createEl("input", {
            type: "checkbox",
            cls: "fn-gcal-hidden",
            attr: { id }
        });
        dummy.checked = initial;
        return dummy;
    }

    private renderMobileDisclosure(
        container: HTMLElement,
        label: string,
        icon: string,
        renderContent: (container: HTMLElement) => void,
        open = false,
        getSummary?: () => string
    ): void {
        const details = container.createEl("details", { cls: "fn-mobile-disclosure" });
        details.open = open;
        const summary = details.createEl("summary", { cls: "fn-mobile-disclosure-summary" });
        const iconEl = summary.createSpan({ cls: "fn-mobile-disclosure-icon" });
        setIcon(iconEl, icon);
        const labelWrap = summary.createSpan({ cls: "fn-mobile-disclosure-label-wrap" });
        labelWrap.createSpan({ cls: "fn-mobile-disclosure-label", text: label });
        const summaryText = getSummary
            ? labelWrap.createSpan({ cls: "fn-mobile-disclosure-value", text: getSummary() })
            : null;
        const chevron = summary.createSpan({ cls: "fn-mobile-disclosure-chevron" });
        setIcon(chevron, "chevron-down");

        const content = details.createDiv({ cls: "fn-mobile-disclosure-content" });
        renderContent(content);
        if (summaryText && getSummary) {
            details.addEventListener("toggle", () => summaryText.setText(getSummary()));
        }
    }
}

// ---------------------------------------------------------------------------

class FilePickerSuggester extends FuzzySuggestModal<TFile> {
    constructor(app: App, private onPick: (file: TFile) => void) {
        super(app);
        this.setPlaceholder("Pick a note...");
    }
    getItems(): TFile[] {
        return this.app.vault.getMarkdownFiles().filter(isTFile);
    }
    getItemText(f: TFile): string {
        return f.path;
    }
    onChooseItem(f: TFile): void {
        this.onPick(f);
    }
}
