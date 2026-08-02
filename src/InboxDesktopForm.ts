import { App, setIcon } from "obsidian";
import { EventTaskFormState } from "./EventTaskFormState";
import { normalizeInboxFolders } from "./InboxFolderSettings";
import { InboxNotesController } from "./InboxNotesController";
import { FileSuggest } from "./Suggesters";
import type { FocusNotesSettings, FocusTarget, InboxTargetMode, InsertPosition } from "./types";

interface InboxDesktopFormOptions {
    app: App;
    form: EventTaskFormState;
    getSettings(): FocusNotesSettings;
    resolveTarget(): FocusTarget | null;
}

/** Desktop-only Inbox fields kept separate from the event/task modal shell. */
export class InboxDesktopForm {
    private notesController: InboxNotesController | null = null;
    private targetSummaryEl: HTMLElement | null = null;

    constructor(private readonly options: InboxDesktopFormOptions) {}

    render(container: HTMLElement): void {
        const notesContent = this.makeRow(container, "align-left");
        const notesWrap = notesContent.createDiv({ cls: "fn-inbox-notes-wrap" });
        notesWrap.createDiv({ cls: "fn-gcal-field-label", text: "Notes" });
        const notesEl = notesWrap.createDiv({
            cls: "fn-inbox-notes-input",
            attr: {
                "aria-label": "Inbox notes",
                "data-placeholder": "Capture context. Type @ for People or Places, # for tags."
            }
        });

        this.notesController = new InboxNotesController(this.options.app, notesEl, {
            initialValue: this.options.form.inboxBody,
            targetFile: this.options.resolveTarget()?.file ?? "",
            getPeopleFolders: () => this.getPeopleFolders(),
            getPlaceFolders: () => this.getPlaceFolders(),
            onChange: value => (this.options.form.inboxBody = value)
        });

        this.renderAdvanced(container);
    }

    destroy(): void {
        this.notesController?.destroy();
        this.notesController = null;
        this.targetSummaryEl = null;
    }

    private renderAdvanced(container: HTMLElement): void {
        const advanced = container.createEl("details", { cls: "fn-inbox-advanced" });
        advanced.createEl("summary", { text: "Advanced" });
        const fields = advanced.createDiv({ cls: "fn-inbox-advanced-fields" });

        this.targetSummaryEl = fields.createDiv({ cls: "fn-inbox-target-summary" });
        this.refreshTarget(false);

        const destinationLabel = fields.createEl("label", { text: "Destination" });
        const destination = destinationLabel.createEl("select", {
            attr: { "aria-label": "Inbox destination" }
        });
        destination.createEl("option", { text: "Daily Note", value: "daily-note" });
        destination.createEl("option", { text: "Event/Task target", value: "event-task-target" });
        destination.value = this.options.form.inboxTargetMode;
        destination.addEventListener("change", () => {
            this.options.form.inboxTargetMode = destination.value as InboxTargetMode;
            this.refreshTarget();
        });

        const fileLabel = fields.createEl("label", { text: "File override" });
        const file = fileLabel.createEl("input", {
            type: "text",
            attr: {
                placeholder: "Leave empty to use the selected destination",
                "aria-label": "Inbox file override"
            }
        });
        file.value = this.options.form.inboxTargetFileOverride;
        file.addEventListener("input", () => {
            this.options.form.inboxTargetFileOverride = file.value;
            this.refreshTarget(false);
        });
        file.addEventListener("change", () => this.refreshTarget());
        new FileSuggest(this.options.app, file);

        const headingLabel = fields.createEl("label", { text: "Heading" });
        const heading = headingLabel.createEl("input", {
            type: "text",
            attr: { placeholder: "Inbox", "aria-label": "Inbox heading" }
        });
        heading.value = this.options.form.inboxHeading;
        heading.addEventListener("input", () => {
            this.options.form.inboxHeading = heading.value;
            this.refreshTarget(false);
        });

        const positionLabel = fields.createEl("label", { text: "Insert position" });
        const position = positionLabel.createEl("select", {
            attr: { "aria-label": "Inbox insert position" }
        });
        position.createEl("option", { text: "End of section", value: "end" });
        position.createEl("option", { text: "Start of section", value: "start" });
        position.value = this.options.form.inboxPosition;
        position.addEventListener("change", () => {
            this.options.form.inboxPosition = position.value as InsertPosition;
        });

        const settings = this.options.getSettings().inbox;
        this.renderFolderOverride(
            fields,
            "People folders override",
            settings.peopleFolders,
            value => (this.options.form.inboxPeopleFoldersOverride = value)
        );
        this.renderFolderOverride(
            fields,
            "Place folders override",
            settings.placeFolders,
            value => (this.options.form.inboxPlaceFoldersOverride = value)
        );
    }

    private renderFolderOverride(
        container: HTMLElement,
        label: string,
        defaults: string[],
        onChange: (folders: string[]) => void
    ): void {
        const wrap = container.createEl("label", { text: label });
        const input = wrap.createEl("textarea", {
            attr: {
                placeholder: `Using Settings: ${defaults.join(", ")}`,
                "aria-label": label
            }
        });
        input.rows = 2;
        input.addEventListener("input", () => {
            onChange(normalizeInboxFolders(input.value.split(/\r?\n/)));
        });
    }

    private getPeopleFolders(): string[] {
        const override = this.options.form.inboxPeopleFoldersOverride;
        return override.length > 0 ? override : this.options.getSettings().inbox.peopleFolders;
    }

    private getPlaceFolders(): string[] {
        const override = this.options.form.inboxPlaceFoldersOverride;
        return override.length > 0 ? override : this.options.getSettings().inbox.placeFolders;
    }

    private refreshTarget(updateNotes = true): void {
        const target = this.options.resolveTarget();
        this.targetSummaryEl?.setText(
            target
                ? `${target.file} · ${target.heading || "No heading"}`
                : "Selected destination is unavailable"
        );
        if (updateNotes && target) this.notesController?.setTargetFile(target.file);
    }

    private makeRow(container: HTMLElement, icon: string): HTMLElement {
        const row = container.createDiv({ cls: "fn-gcal-row" });
        const iconEl = row.createDiv({ cls: "fn-gcal-row-icon" });
        setIcon(iconEl, icon);
        return row.createDiv({ cls: "fn-gcal-row-content" });
    }
}
