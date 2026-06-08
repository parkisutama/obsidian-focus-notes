import {
    App,
    FuzzySuggestModal,
    Modal,
    Notice,
    TFile,
    setIcon
} from "obsidian";
import { FocusNotesSettings, InsertPosition } from "./types";
import { EventRecord, HubNoteRef, EventTaskRecord, EventTaskWriter, TaskRecord } from "./EventTaskWriter";
import { FileSuggest } from "./Suggesters";
import { TargetResolver } from "./TargetResolver";
import { isTFile } from "./utils";

type ItemKind = "event" | "task";
type HubMode = "none" | "link" | "create";

interface ReminderEntry {
    date: string;
    time: string;
}

export function openEventTaskForm(
    app: App,
    getSettings: () => FocusNotesSettings,
    saveSettings: () => Promise<void>,
    anchorDate: Date = new Date(),
    onComplete: () => void = () => {}
): void {
    if (isMobileFormViewport()) {
        new EventTaskMobileSheet(app, getSettings, saveSettings, anchorDate, onComplete).open();
        return;
    }

    new EventTaskModal(app, getSettings, saveSettings, anchorDate, onComplete).open();
}

function isMobileFormViewport(): boolean {
    return document.body.hasClass("is-mobile") || window.innerWidth <= 640;
}

export class EventTaskModal extends Modal {
    protected kind: ItemKind = "event";

    // ---- Event fields -------------------------------------------------------
    private eventDate: string;
    private eventStartTime: string;
    private eventEndTime: string;
    private eventAllDay = false;

    // ---- Task fields --------------------------------------------------------
    private taskDueDate: string;
    private taskDueTime = "09:00";
    private taskDueHasTime = false;

    // Timebox (optional start-end block for task)
    private taskTimeboxEnabled = false;
    private taskTimeboxDate: string;
    private taskTimeboxStartTime: string;
    private taskTimeboxEndTime: string;

    // Multiple reminders (dynamic list)
    private reminders: ReminderEntry[] = [];

    // ---- Common fields ------------------------------------------------------
    private title = "";
    private description = "";

    // ---- Hub note -----------------------------------------------------------
    private hubMode: HubMode = "none";
    private hubLinkPath = "";
    private hubCreateName = "";
    private writeToHubNote = false;

    // ---- Detail note --------------------------------------------------------
    private detailNoteEnabled = false;
    private detailNoteName = "";
    private detailNoteFolder = "";

    // ---- Target -------------------------------------------------------------
    private targetFile: string;
    private targetHeading: string;
    private targetPosition: InsertPosition;

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

        const now = anchorDate;
        const h = now.getHours();
        const endH = Math.min(h + 1, 23);
        this.eventDate = this.isoDate(now);
        this.eventStartTime = `${String(h).padStart(2, "0")}:00`;
        this.eventEndTime = `${String(endH).padStart(2, "0")}:00`;
        this.taskDueDate = this.isoDate(now);
        this.taskTimeboxDate = this.isoDate(now);
        this.taskTimeboxStartTime = this.eventStartTime;
        this.taskTimeboxEndTime = this.eventEndTime;

        const settings = getSettings();
        const resolver = new TargetResolver(app, settings);
        const resolved = resolver.resolve(resolver.getActiveTarget(), now);
        this.targetFile = resolved.file;
        this.targetHeading = settings.eventTask.defaultSaveHeading || resolved.heading;
        this.targetPosition = resolved.position;
        this.detailNoteFolder = settings.eventTask.detailNotesFolder;
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
            attr: { placeholder: "Add title" }
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
        this.title = value;
        // Sync hub note name only while still at default
        if (this.hubMode === "create" && this.hubInputEl) {
            if (!this.hubInputEl.value || this.hubInputEl.value === this.hubCreateName) {
                this.hubInputEl.value = this.title;
                this.hubCreateName = this.title;
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
            this.kind = "event";
            eventBtn.addClass("fn-gcal-tab--active");
            taskBtn.removeClass("fn-gcal-tab--active");
            this.eventSectionEl.removeClass("fn-gcal-hidden");
            this.taskSectionEl.addClass("fn-gcal-hidden");
        });
        taskBtn.addEventListener("click", () => {
            this.kind = "task";
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
        const dateEl = this.makeDateInput(mainRow, this.eventDate);
        dateEl.addEventListener("change", () => (this.eventDate = dateEl.value));

        this.eventTimeRowEl = mainRow.createDiv({ cls: "fn-gcal-time-range" });
        const startEl = this.makeTimeInput(this.eventTimeRowEl, this.eventStartTime);
        startEl.addEventListener("change", () => (this.eventStartTime = startEl.value));
        this.eventTimeRowEl.createSpan({ cls: "fn-gcal-time-sep", text: "—" });
        const endEl = this.makeTimeInput(this.eventTimeRowEl, this.eventEndTime);
        endEl.addEventListener("change", () => (this.eventEndTime = endEl.value));

        this.makeCheckboxRow(wrap, "All day", "fn-gcal-allday", checked => {
            this.eventAllDay = checked;
            this.eventTimeRowEl.toggleClass("fn-gcal-hidden", checked);
        });
    }

    // ---- Task section -------------------------------------------------------

    protected renderTaskSection(container: HTMLElement): void {
        // TENGGAT
        const dueContent = this.makeRow(container, "calendar");
        const dueWrap = dueContent.createDiv();
        dueWrap.createDiv({ cls: "fn-gcal-field-label", text: "Due date (optional)" });

        const dueDateRow = dueWrap.createDiv({ cls: "fn-gcal-datetime-row" });
        const dueDateEl = this.makeDateInput(dueDateRow, this.taskDueDate);
        dueDateEl.addEventListener("change", () => (this.taskDueDate = dueDateEl.value));

        this.taskDueTimeEl = this.makeTimeInput(dueDateRow, this.taskDueTime);
        this.taskDueTimeEl.addClass("fn-gcal-hidden");
        this.taskDueTimeEl.addEventListener("change", () => (this.taskDueTime = this.taskDueTimeEl.value));

        this.makeCheckboxRow(dueWrap, "Include time", "fn-gcal-due-time", checked => {
            this.taskDueHasTime = checked;
            this.taskDueTimeEl.toggleClass("fn-gcal-hidden", !checked);
        });

        // TIMEBOX (start – end)
        const timeboxContent = this.makeRow(container, "timer");
        const timeboxWrap = timeboxContent.createDiv();
        this.makeCheckboxRow(timeboxWrap, "Timebox (start – end)", "fn-gcal-timebox", checked => {
            this.taskTimeboxEnabled = checked;
            this.taskTimeboxRowEl.toggleClass("fn-gcal-hidden", !checked);
        });
        this.taskTimeboxRowEl = timeboxWrap.createDiv({ cls: "fn-gcal-datetime-row fn-gcal-hidden" });
        this.taskTimeboxDateEl = this.makeDateInput(this.taskTimeboxRowEl, this.taskTimeboxDate);
        this.taskTimeboxDateEl.addEventListener("change", () => (this.taskTimeboxDate = this.taskTimeboxDateEl.value));
        this.taskTimeboxStartEl = this.makeTimeInput(this.taskTimeboxRowEl, this.taskTimeboxStartTime);
        this.taskTimeboxStartEl.addEventListener("change", () => (this.taskTimeboxStartTime = this.taskTimeboxStartEl.value));
        this.taskTimeboxRowEl.createSpan({ cls: "fn-gcal-time-sep", text: "—" });
        this.taskTimeboxEndEl = this.makeTimeInput(this.taskTimeboxRowEl, this.taskTimeboxEndTime);
        this.taskTimeboxEndEl.addEventListener("change", () => (this.taskTimeboxEndTime = this.taskTimeboxEndEl.value));

        // PENGINGAT (dynamic list)
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
            this.addReminderRow(this.isoDate(this.anchorDate), "09:00");
        });
    }

    protected addReminderRow(date: string, time: string): void {
        const idx = this.reminders.length;
        this.reminders.push({ date, time });

        const row = this.remindersListEl.createDiv({ cls: "fn-gcal-reminder-row" });
        const dateEl = this.makeDateInput(row, date);
        dateEl.addEventListener("change", () => (this.reminders[idx].date = dateEl.value));
        const timeEl = this.makeTimeInput(row, time);
        timeEl.addEventListener("change", () => (this.reminders[idx].time = timeEl.value));

        const delBtn = row.createEl("button", { cls: "fn-gcal-remind-del-btn", attr: { type: "button" } });
        setIcon(delBtn, "x");
        delBtn.addEventListener("click", evt => {
            evt.preventDefault();
            row.remove();
            // Mark as deleted by clearing date
            this.reminders[idx].date = "";
        });
    }

    // ---- Description --------------------------------------------------------

    protected renderDescription(container: HTMLElement): void {
        const content = this.makeRow(container, "align-left");
        const textarea = content.createEl("textarea", {
            cls: "fn-gcal-desc-input",
            attr: { placeholder: "Add description or attachment..." }
        });
        textarea.rows = 3;
        textarea.addEventListener("input", () => (this.description = textarea.value));
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
            attr: { placeholder: "Search notes..." }
        });
        this.hubInputEl.addEventListener("input", () => {
            if (this.hubMode === "link") this.hubLinkPath = this.hubInputEl.value;
            else this.hubCreateName = this.hubInputEl.value;
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
                this.hubLinkPath = file.path;
            }).open();
        });

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
            this.writeToHubNote = this.writeToHubCb.checked;
        });

        // Chip selector for hub mode (replaces radio group)
        this.makeChipGroup<HubMode>(
            wrap,
            [
                { value: "none",   label: "None" },
                { value: "link",   label: "Link" },
                { value: "create", label: "New note" },
            ],
            this.hubMode,
            value => {
                this.hubMode = value;
                const showInput = value !== "none";
                hubInputRow.toggleClass("fn-gcal-hidden", !showInput);
                pickBtn.toggleClass("fn-gcal-hidden", value === "create");
                this.hubAlsoRowEl.toggleClass("fn-gcal-hidden", !showInput);
                this.hubInputEl.placeholder = value === "link" ? "Search notes..." : "New note name";
                if (value === "create") {
                    this.hubInputEl.value = this.title;
                    this.hubCreateName = this.title;
                } else {
                    this.hubInputEl.value = "";
                    this.hubLinkPath = "";
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
            this.detailNoteEnabled = checked;
            this.detailNoteRowEl.toggleClass("fn-gcal-hidden", !checked);
            if (checked && !this.detailNoteInputEl.value) {
                this.detailNoteInputEl.value = this.title;
                this.detailNoteName = this.title;
            }
        });

        this.detailNoteRowEl = wrap.createDiv({ cls: "fn-gcal-saveto-fields fn-gcal-hidden" });

        this.detailNoteInputEl = this.detailNoteRowEl.createEl("input", {
            type: "text",
            cls: "fn-gcal-saveto-heading",
            attr: { placeholder: "Detail note name..." }
        });
        this.detailNoteInputEl.addEventListener("input", () => {
            this.detailNoteName = this.detailNoteInputEl.value;
        });

        const folderEl = this.detailNoteRowEl.createEl("input", {
            type: "text",
            cls: "fn-gcal-saveto-file",
            attr: { placeholder: "Folder (e.g. Notes/Events)" }
        });
        folderEl.value = this.detailNoteFolder;
        folderEl.addEventListener("input", () => {
            this.detailNoteFolder = folderEl.value;
        });
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
            attr: { placeholder: "Journal/2026-05-27.md" }
        });
        fileEl.value = this.targetFile;
        fileEl.addEventListener("input", () => (this.targetFile = fileEl.value));
        new FileSuggest(this.app, fileEl);

        const headingEl = fields.createEl("input", {
            type: "text",
            cls: "fn-gcal-saveto-heading",
            attr: { placeholder: "Heading (optional)" }
        });
        headingEl.value = this.targetHeading;
        headingEl.addEventListener("input", () => (this.targetHeading = headingEl.value));

        this.makeCheckboxRow(wrap, "Insert at top (not bottom)", "fn-gcal-pos-start", checked => {
            this.targetPosition = checked ? "start" : "end";
        }, this.targetPosition === "start");
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

        if (!this.title.trim()) {
            new Notice("Please enter a title.");
            return;
        }
        if (!this.targetFile.trim()) {
            new Notice("Please select a target file.");
            return;
        }

        const settings = this.getSettings();
        const writer = new EventTaskWriter(this.app, settings.eventTask);
        let hubNoteRef: HubNoteRef | null = null;
        let hubNoteFilePath: string | null = null;

        if (this.hubMode === "create") {
            const hubName = (this.hubCreateName.trim() || this.title.trim());
            if (hubName) {
                try {
                    const hubFile = await writer.createHubNote(
                        hubName,
                        this.buildRecord(null),
                        settings.eventTask.hubNotesFolder
                    );
                    hubNoteRef = { title: this.title.trim(), path: hubFile.path };
                    hubNoteFilePath = hubFile.path;
                    // Open hub note passively
                    void this.app.workspace.getLeaf(false).openFile(hubFile, { active: false });
                } catch (err) {
                    new Notice(`Failed to create note: ${(err as Error).message}`);
                    return;
                }
            }
        } else if (this.hubMode === "link" && this.hubLinkPath.trim()) {
            const found = this.app.vault.getAbstractFileByPath(this.hubLinkPath.trim());
            if (isTFile(found)) {
                hubNoteRef = { title: this.title.trim(), path: found.path };
                hubNoteFilePath = found.path;
            } else {
                // Fallback: use the typed value as a relative path
                const p = this.hubLinkPath.trim();
                hubNoteRef = { title: this.title.trim(), path: p.endsWith(".md") ? p : `${p}.md` };
                hubNoteFilePath = hubNoteRef.path;
            }
        }

        // Create detail note (third file) if requested — needs hub path first
        let detailNoteRef: HubNoteRef | null = null;
        if (this.detailNoteEnabled) {
            const detailName = this.detailNoteName.trim() || this.title.trim();
            if (detailName) {
                try {
                    const detailFile = await writer.createDetailNote(
                        detailName,
                        this.buildRecord(hubNoteRef),
                        this.detailNoteFolder.trim() || settings.eventTask.detailNotesFolder,
                        this.targetFile.trim(),
                        hubNoteFilePath
                    );
                    detailNoteRef = { title: this.title.trim(), path: detailFile.path };
                    void this.app.workspace.getLeaf(false).openFile(detailFile, { active: false });
                } catch (err) {
                    new Notice(`Failed to create detail note: ${(err as Error).message}`);
                    return;
                }
            }
        }

        const record = this.buildRecord(hubNoteRef);
        const heading = this.targetHeading.trim();
        const pos = this.targetPosition;

        try {
            await writer.write(record, this.targetFile.trim(), heading, pos, detailNoteRef);

            // Also write to hub note:
            // The main link in the hub's line points BACK to target (not hub itself),
            // so the hub can navigate to the origin daily note. Detail sub-bullet is included too.
            if (this.writeToHubNote && hubNoteFilePath) {
                const targetRef: HubNoteRef = {
                    title: this.title.trim(),
                    path: this.targetFile.trim()
                };
                const hubRecord = { ...record, hubNoteRef: targetRef } as EventTaskRecord;
                await writer.write(hubRecord, hubNoteFilePath, heading, pos, detailNoteRef);
            }

            new Notice(this.kind === "event" ? "Event saved." : "Task saved.");
            this.resolved = true;
            this.onComplete();
            this.close();
        } catch (err) {
            new Notice(`Failed to save: ${(err as Error).message}`);
        }
    }

    // =========================================================================
    // Record builders
    // =========================================================================

    protected buildRecord(hubNoteRef: HubNoteRef | null): EventTaskRecord {
        if (this.kind === "event") {
            const record: EventRecord = {
                kind: "event",
                title: this.title.trim(),
                start: this.parseDateTime(this.eventDate, this.eventStartTime),
                end: this.parseDateTime(this.eventDate, this.eventEndTime),
                allDay: this.eventAllDay,
                description: this.description,
                hubNoteRef
            };
            return record;
        }

        const validReminders = this.reminders
            .filter(r => r.date)
            .map(r => this.parseDateTime(r.date, r.time || "09:00"));

        const timebox: TaskRecord["timebox"] = this.taskTimeboxEnabled && this.taskTimeboxDate
            ? {
                start: this.parseDateTime(this.taskTimeboxDate, this.taskTimeboxStartTime),
                end: this.parseDateTime(this.taskTimeboxDate, this.taskTimeboxEndTime)
            }
            : null;

        const record: TaskRecord = {
            kind: "task",
            title: this.title.trim(),
            due: this.taskDueDate
                ? this.parseDateTime(this.taskDueDate, this.taskDueHasTime ? this.taskDueTime : "00:00")
                : null,
            dueHasTime: this.taskDueHasTime,
            timebox,
            reminders: validReminders,
            description: this.description,
            hubNoteRef
        };
        return record;
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
        const group = container.createDiv({ cls: "fn-chip-group" });
        options.forEach(({ value, label }) => {
            const btn = group.createEl("button", {
                cls: "fn-chip-option" + (value === initial ? " fn-chip-option--active" : ""),
                attr: { type: "button" }
            });
            btn.textContent = label;
            btn.addEventListener("click", () => {
                group.querySelectorAll<HTMLElement>(".fn-chip-option")
                    .forEach(el => el.removeClass("fn-chip-option--active"));
                btn.addClass("fn-chip-option--active");
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

    protected makeDateInput(container: HTMLElement, value: string): HTMLInputElement {
        const el = container.createEl("input", { type: "date", cls: "fn-gcal-date-input" });
        el.value = value;
        return el;
    }

    protected makeTimeInput(container: HTMLElement, value: string): HTMLInputElement {
        const el = container.createEl("input", { type: "time", cls: "fn-gcal-time-input" });
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

    protected parseDateTime(dateStr: string, timeStr: string): Date {
        const d = new Date(`${dateStr}T${timeStr || "00:00"}:00`);
        return isNaN(d.getTime()) ? new Date() : d;
    }

    protected isoDate(date: Date): string {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }
}

export class EventTaskMobileSheet extends EventTaskModal {
    private sheetEl: HTMLElement | null = null;
    private sheetContentEl: HTMLElement | null = null;
    private cleanupSheetEvents: (() => void) | null = null;

    open(): void {
        if (this.sheetEl) return;

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
        this.renderTaskSection(this.taskSectionEl);
        this.renderDescription(body);

        const advanced = body.createDiv({ cls: "fn-mobile-advanced-list" });
        this.renderMobileDisclosure(advanced, "Related note", "link", container => this.renderHubNote(container));
        this.renderMobileDisclosure(advanced, "Detail note", "file-text", container => this.renderDetailNote(container));
        this.renderMobileDisclosure(advanced, "Save to", "folder", container => this.renderSaveTo(container), true);

        this.setupMobileViewportSupport(contentEl, viewportVariableTarget);
    }

    protected renderTitle(container: HTMLElement): void {
        const titleInput = container.createEl("input", {
            type: "text",
            cls: "fn-gcal-title-input fn-mobile-title-input",
            attr: { placeholder: "Add title" }
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
            attr: { type: "button" }
        });
        row.createSpan({ cls: "fn-mobile-toggle-label", text: label });
        const indicator = row.createSpan({ cls: "fn-mobile-toggle-indicator" });
        setIcon(indicator, initial ? "check-circle-2" : "circle");

        row.addEventListener("click", () => {
            checked = !checked;
            row.toggleClass("fn-mobile-toggle-row--on", checked);
            indicator.empty();
            setIcon(indicator, checked ? "check-circle-2" : "circle");
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
        open = false
    ): void {
        const details = container.createEl("details", { cls: "fn-mobile-disclosure" });
        details.open = open;
        const summary = details.createEl("summary", { cls: "fn-mobile-disclosure-summary" });
        const iconEl = summary.createSpan({ cls: "fn-mobile-disclosure-icon" });
        setIcon(iconEl, icon);
        summary.createSpan({ cls: "fn-mobile-disclosure-label", text: label });
        const chevron = summary.createSpan({ cls: "fn-mobile-disclosure-chevron" });
        setIcon(chevron, "chevron-down");

        const content = details.createDiv({ cls: "fn-mobile-disclosure-content" });
        renderContent(content);
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
