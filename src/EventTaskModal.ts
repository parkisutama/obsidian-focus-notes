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

export class EventTaskModal extends Modal {
    private kind: ItemKind = "event";

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

    // ---- Target -------------------------------------------------------------
    private targetFile: string;
    private targetHeading: string;
    private targetPosition: InsertPosition;

    private resolved = false;

    // ---- DOM refs -----------------------------------------------------------
    private hubInputEl!: HTMLInputElement;
    private hubAlsoRowEl!: HTMLElement;
    private writeToHubCb!: HTMLInputElement;
    private eventSectionEl!: HTMLElement;
    private taskSectionEl!: HTMLElement;
    private eventTimeRowEl!: HTMLElement;
    private taskDueTimeEl!: HTMLInputElement;
    private taskTimeboxRowEl!: HTMLElement;
    private taskTimeboxDateEl!: HTMLInputElement;
    private taskTimeboxStartEl!: HTMLInputElement;
    private taskTimeboxEndEl!: HTMLInputElement;
    private remindersListEl!: HTMLElement;

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
    }

    onOpen(): void {
        this.modalEl.addClass("fn-gcal-modal");
        const { contentEl } = this;
        contentEl.empty();
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
        this.renderSaveTo(body);
        this.renderButtons(contentEl);
    }

    onClose(): void {
        this.contentEl.empty();
        if (!this.resolved) this.resolved = true;
    }

    // =========================================================================
    // Render helpers
    // =========================================================================

    private renderTitle(container: HTMLElement): void {
        const titleInput = container.createEl("input", {
            type: "text",
            cls: "fn-gcal-title-input",
            attr: { placeholder: "Tambah judul" }
        });
        titleInput.addEventListener("input", () => {
            this.title = titleInput.value;
            // Sync hub note name only while still at default
            if (this.hubMode === "create" && this.hubInputEl) {
                if (!this.hubInputEl.value || this.hubInputEl.value === this.hubCreateName) {
                    this.hubInputEl.value = this.title;
                    this.hubCreateName = this.title;
                }
            }
        });
        titleInput.addEventListener("keydown", evt => {
            if (evt.key === "Enter" && !evt.shiftKey) {
                evt.preventDefault();
                void this.submit();
            }
        });
        window.setTimeout(() => titleInput.focus(), 50);
    }

    private renderTabs(container: HTMLElement): void {
        const tabs = container.createDiv({ cls: "fn-gcal-tabs" });
        const eventBtn = tabs.createEl("button", {
            cls: "fn-gcal-tab fn-gcal-tab--active",
            text: "Event"
        });
        const taskBtn = tabs.createEl("button", { cls: "fn-gcal-tab", text: "Task" });

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

    private renderEventSection(container: HTMLElement): void {
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

        this.makeCheckboxRow(wrap, "Sepanjang hari", "fn-gcal-allday", checked => {
            this.eventAllDay = checked;
            this.eventTimeRowEl.toggleClass("fn-gcal-hidden", checked);
        });
    }

    // ---- Task section -------------------------------------------------------

    private renderTaskSection(container: HTMLElement): void {
        // TENGGAT
        const dueContent = this.makeRow(container, "calendar");
        const dueWrap = dueContent.createDiv();
        dueWrap.createDiv({ cls: "fn-gcal-field-label", text: "Tenggat (opsional)" });

        const dueDateRow = dueWrap.createDiv({ cls: "fn-gcal-datetime-row" });
        const dueDateEl = this.makeDateInput(dueDateRow, this.taskDueDate);
        dueDateEl.addEventListener("change", () => (this.taskDueDate = dueDateEl.value));

        this.taskDueTimeEl = this.makeTimeInput(dueDateRow, this.taskDueTime);
        this.taskDueTimeEl.addClass("fn-gcal-hidden");
        this.taskDueTimeEl.addEventListener("change", () => (this.taskDueTime = this.taskDueTimeEl.value));

        this.makeCheckboxRow(dueWrap, "Sertakan waktu", "fn-gcal-due-time", checked => {
            this.taskDueHasTime = checked;
            this.taskDueTimeEl.toggleClass("fn-gcal-hidden", !checked);
        });

        // TIMEBOX (start – end)
        const timeboxContent = this.makeRow(container, "timer");
        const timeboxWrap = timeboxContent.createDiv();
        this.makeCheckboxRow(timeboxWrap, "Timebox (waktu mulai – selesai)", "fn-gcal-timebox", checked => {
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
        remindWrap.createDiv({ cls: "fn-gcal-field-label", text: "Pengingat" });

        this.remindersListEl = remindWrap.createDiv({ cls: "fn-gcal-reminders-list" });

        const addRemindBtn = remindWrap.createEl("button", {
            cls: "fn-gcal-add-remind-btn",
            text: "+ Tambah pengingat"
        });
        addRemindBtn.addEventListener("click", evt => {
            evt.preventDefault();
            this.addReminderRow(this.isoDate(this.anchorDate), "09:00");
        });
    }

    private addReminderRow(date: string, time: string): void {
        const idx = this.reminders.length;
        this.reminders.push({ date, time });

        const row = this.remindersListEl.createDiv({ cls: "fn-gcal-reminder-row" });
        const dateEl = this.makeDateInput(row, date);
        dateEl.addEventListener("change", () => (this.reminders[idx].date = dateEl.value));
        const timeEl = this.makeTimeInput(row, time);
        timeEl.addEventListener("change", () => (this.reminders[idx].time = timeEl.value));

        const delBtn = row.createEl("button", { cls: "fn-gcal-remind-del-btn" });
        setIcon(delBtn, "x");
        delBtn.addEventListener("click", evt => {
            evt.preventDefault();
            row.remove();
            // Mark as deleted by clearing date
            this.reminders[idx].date = "";
        });
    }

    // ---- Description --------------------------------------------------------

    private renderDescription(container: HTMLElement): void {
        const content = this.makeRow(container, "align-left");
        const textarea = content.createEl("textarea", {
            cls: "fn-gcal-desc-input",
            attr: { placeholder: "Tambah deskripsi atau lampiran..." }
        });
        textarea.rows = 3;
        textarea.addEventListener("input", () => (this.description = textarea.value));
    }

    // ---- Hub note -----------------------------------------------------------

    private renderHubNote(container: HTMLElement): void {
        const content = this.makeRow(container, "link");
        const wrap = content.createDiv({ cls: "fn-gcal-hub-wrap" });
        wrap.createDiv({ cls: "fn-gcal-field-label", text: "Catatan terkait" });

        // Input row (created first so it's available in radio closures)
        const hubInputRow = wrap.createDiv({ cls: "fn-gcal-hub-input-row fn-gcal-hidden" });
        this.hubInputEl = hubInputRow.createEl("input", {
            type: "text",
            cls: "fn-gcal-hub-input",
            attr: { placeholder: "Cari catatan..." }
        });
        this.hubInputEl.addEventListener("input", () => {
            if (this.hubMode === "link") this.hubLinkPath = this.hubInputEl.value;
            else this.hubCreateName = this.hubInputEl.value;
        });
        new FileSuggest(this.app, this.hubInputEl);

        const pickBtn = hubInputRow.createEl("button", {
            cls: "fn-gcal-hub-pick-btn",
            text: "Pilih"
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
            text: "Juga tulis ke catatan terkait (heading sama)",
            attr: { for: "fn-gcal-also-hub" }
        });
        this.writeToHubCb.addEventListener("change", () => {
            this.writeToHubNote = this.writeToHubCb.checked;
        });

        // Radio options (inserted before input row via DOM manipulation)
        const radioGroup = wrap.createDiv({ cls: "fn-gcal-hub-radio-group" });
        wrap.insertBefore(radioGroup, hubInputRow);

        const options: Array<[HubMode, string]> = [
            ["none", "Tanpa catatan"],
            ["link", "Hubungkan ke catatan yang ada"],
            ["create", "Buat catatan baru"]
        ];
        options.forEach(([value, label]) => {
            const optionEl = radioGroup.createDiv({ cls: "fn-gcal-hub-option" });
            const rb = optionEl.createEl("input", {
                type: "radio",
                cls: "fn-gcal-radio",
                attr: { name: "fn-gcal-hub", value, id: `fn-gcal-hub-${value}` }
            });
            if (value === "none") rb.checked = true;
            optionEl.createEl("label", { text: label, attr: { for: `fn-gcal-hub-${value}` } });
            rb.addEventListener("change", () => {
                if (!rb.checked) return;
                this.hubMode = value;
                const showInput = value !== "none";
                hubInputRow.toggleClass("fn-gcal-hidden", !showInput);
                pickBtn.toggleClass("fn-gcal-hidden", value === "create");
                this.hubAlsoRowEl.toggleClass("fn-gcal-hidden", !showInput);
                this.hubInputEl.placeholder = value === "link" ? "Cari catatan..." : "Nama catatan baru";
                if (value === "create") {
                    this.hubInputEl.value = this.title;
                    this.hubCreateName = this.title;
                } else {
                    this.hubInputEl.value = "";
                    this.hubLinkPath = "";
                }
            });
        });
    }

    // ---- Save to ------------------------------------------------------------

    private renderSaveTo(container: HTMLElement): void {
        const content = this.makeRow(container, "folder");
        const wrap = content.createDiv({ cls: "fn-gcal-saveto-wrap" });
        wrap.createDiv({ cls: "fn-gcal-field-label", text: "Simpan ke" });

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
            attr: { placeholder: "Heading (opsional)" }
        });
        headingEl.value = this.targetHeading;
        headingEl.addEventListener("input", () => (this.targetHeading = headingEl.value));

        this.makeCheckboxRow(wrap, "Sisipkan di atas (bukan di bawah)", "fn-gcal-pos-start", checked => {
            this.targetPosition = checked ? "start" : "end";
        }, this.targetPosition === "start");
    }

    // ---- Buttons ------------------------------------------------------------

    private renderButtons(container: HTMLElement): void {
        const footer = container.createDiv({ cls: "fn-gcal-footer" });
        const discard = footer.createEl("button", { cls: "fn-gcal-btn-discard", text: "Batal" });
        discard.addEventListener("click", () => {
            if (this.resolved) return;
            this.resolved = true;
            this.close();
        });
        const save = footer.createEl("button", { cls: "fn-gcal-btn-save mod-cta", text: "Simpan" });
        save.addEventListener("click", () => void this.submit());
    }

    // =========================================================================
    // Save logic
    // =========================================================================

    private async submit(): Promise<void> {
        if (this.resolved) return;

        if (!this.title.trim()) {
            new Notice("Masukkan judul terlebih dahulu.");
            return;
        }
        if (!this.targetFile.trim()) {
            new Notice("Pilih file tujuan terlebih dahulu.");
            return;
        }

        const writer = new EventTaskWriter(this.app);
        const settings = this.getSettings();
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
                    new Notice(`Gagal membuat catatan: ${(err as Error).message}`);
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

        const record = this.buildRecord(hubNoteRef);
        const heading = this.targetHeading.trim();
        const pos = this.targetPosition;

        try {
            await writer.write(record, this.targetFile.trim(), heading, pos);

            // Also write to hub note if requested
            if (this.writeToHubNote && hubNoteFilePath) {
                await writer.write(record, hubNoteFilePath, heading, pos);
            }

            new Notice(this.kind === "event" ? "Event tersimpan." : "Task tersimpan.");
            this.resolved = true;
            this.onComplete();
            this.close();
        } catch (err) {
            new Notice(`Gagal menyimpan: ${(err as Error).message}`);
        }
    }

    // =========================================================================
    // Record builders
    // =========================================================================

    private buildRecord(hubNoteRef: HubNoteRef | null): EventTaskRecord {
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

    private makeRow(container: HTMLElement, icon: string): HTMLElement {
        const row = container.createDiv({ cls: "fn-gcal-row" });
        const iconEl = row.createDiv({ cls: "fn-gcal-row-icon" });
        setIcon(iconEl, icon);
        return row.createDiv({ cls: "fn-gcal-row-content" });
    }

    private makeDateInput(container: HTMLElement, value: string): HTMLInputElement {
        const el = container.createEl("input", { type: "date", cls: "fn-gcal-date-input" });
        el.value = value;
        return el;
    }

    private makeTimeInput(container: HTMLElement, value: string): HTMLInputElement {
        const el = container.createEl("input", { type: "time", cls: "fn-gcal-time-input" });
        el.value = value;
        return el;
    }

    private makeCheckboxRow(
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

    private parseDateTime(dateStr: string, timeStr: string): Date {
        const d = new Date(`${dateStr}T${timeStr || "00:00"}:00`);
        return isNaN(d.getTime()) ? new Date() : d;
    }

    private isoDate(date: Date): string {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }
}

// ---------------------------------------------------------------------------

class FilePickerSuggester extends FuzzySuggestModal<TFile> {
    constructor(app: App, private onPick: (file: TFile) => void) {
        super(app);
        this.setPlaceholder("Pilih catatan...");
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
