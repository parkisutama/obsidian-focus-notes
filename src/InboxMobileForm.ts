import { type App, setIcon } from "obsidian";
import type { EventTaskFormState } from "./EventTaskFormState";
import { normalizeInboxFolders } from "./InboxFolderSettings";
import { InboxNotesController } from "./InboxNotesController";
import { FileSuggest } from "./Suggesters";
import type { FocusNotesSettings, FocusTarget, InsertPosition } from "./types";

interface InboxMobileFormOptions {
    app: App;
    form: EventTaskFormState;
    getSettings(): FocusNotesSettings;
    resolveTarget(): FocusTarget | null;
    registerCleanup(cleanup: () => void): void;
}

/** Compact Inbox fields for the independent mobile full-screen editor. */
export class InboxMobileForm {
    private notesController: InboxNotesController | null = null;
    private targetSummaryEl: HTMLElement | null = null;

    constructor(private readonly options: InboxMobileFormOptions) {}

    render(container: HTMLElement): void {
        const notes = this.fieldRow(container, "align-left", "Notes");
        const notesEl = notes.createDiv({
            cls: "fn-mobile-inbox-notes",
            attr: {
                "aria-label": "Inbox notes",
                "data-placeholder": "Add context. Use @ for People or Places, # for tags.",
            },
        });
        this.notesController = new InboxNotesController(this.options.app, notesEl, {
            initialValue: this.options.form.inboxBody,
            targetFile: this.options.resolveTarget()?.file ?? "",
            getPeopleFolders: () => this.peopleFolders,
            getPlaceFolders: () => this.placeFolders,
            onChange: (value) => (this.options.form.inboxBody = value),
        });
        this.options.registerCleanup(() => this.destroy());

        const advanced = container.createEl("details", { cls: "fn-mobile-event-disclosure fn-mobile-inbox-advanced" });
        const summary = advanced.createEl("summary", { cls: "fn-mobile-event-summary" });
        const icon = summary.createSpan({ cls: "fn-mobile-event-summary-icon" });
        setIcon(icon, "sliders-horizontal");
        const text = summary.createSpan({ cls: "fn-mobile-event-summary-text" });
        text.createSpan({ text: "More options" });
        text.createEl("small", { text: "Save location and suggestion sources" });
        const chevron = summary.createSpan({ cls: "fn-mobile-event-summary-chevron" });
        setIcon(chevron, "chevron-down");
        this.renderAdvanced(advanced.createDiv({ cls: "fn-mobile-event-disclosure-content" }));
    }

    destroy(): void {
        this.notesController?.destroy();
        this.notesController = null;
        this.targetSummaryEl = null;
    }

    private renderAdvanced(container: HTMLElement): void {
        this.targetSummaryEl = container.createDiv({ cls: "fn-mobile-inbox-target" });
        this.refreshTarget(false);

        const file = this.textField(container, "file-text", "Save to", "Note path");
        file.value = this.options.form.inboxTargetFile;
        file.addEventListener("input", () => {
            this.options.form.inboxTargetFile = file.value;
            this.refreshTarget();
        });
        const fileSuggest = new FileSuggest(this.options.app, file);
        this.options.registerCleanup(() => fileSuggest.close());

        const heading = this.textField(container, "hash", "Heading", "Inbox");
        heading.value = this.options.form.inboxHeading;
        heading.addEventListener("input", () => {
            this.options.form.inboxHeading = heading.value;
            this.refreshTarget(false);
        });

        const position = this.selectField(
            container,
            "list-end",
            "Insert position",
            [
                { value: "end", label: "End of section" },
                { value: "start", label: "Start of section" },
            ],
            this.options.form.inboxPosition,
        );
        position.addEventListener("change", () => {
            this.options.form.inboxPosition = position.value as InsertPosition;
        });

        const settings = this.options.getSettings().inbox;
        this.folderField(container, "People folders", settings.peopleFolders, (value) => {
            this.options.form.inboxPeopleFoldersOverride = value;
        });
        this.folderField(container, "Place folders", settings.placeFolders, (value) => {
            this.options.form.inboxPlaceFoldersOverride = value;
        });
    }

    private fieldRow(container: HTMLElement, icon: string, label: string): HTMLElement {
        const row = container.createDiv({ cls: "fn-mobile-event-field-row" });
        const iconEl = row.createSpan({ cls: "fn-mobile-event-field-icon" });
        setIcon(iconEl, icon);
        const content = row.createDiv({ cls: "fn-mobile-event-field-content" });
        content.createDiv({ cls: "fn-mobile-event-label", text: label });
        return content;
    }

    private textField(container: HTMLElement, icon: string, label: string, placeholder: string): HTMLInputElement {
        const content = this.fieldRow(container, icon, label);
        return content.createEl("input", {
            type: "text",
            cls: "fn-mobile-event-input",
            attr: { "aria-label": label, placeholder },
        });
    }

    private selectField(
        container: HTMLElement,
        icon: string,
        label: string,
        options: Array<{ value: string; label: string }>,
        initial: string,
    ): HTMLSelectElement {
        const content = this.fieldRow(container, icon, label);
        const select = content.createEl("select", {
            cls: "fn-mobile-event-input",
            attr: { "aria-label": label },
        });
        for (const option of options) select.createEl("option", { value: option.value, text: option.label });
        select.value = initial;
        return select;
    }

    private folderField(
        container: HTMLElement,
        label: string,
        defaults: string[],
        onChange: (folders: string[]) => void,
    ): void {
        const content = this.fieldRow(container, "folder", label);
        const input = content.createEl("textarea", {
            cls: "fn-mobile-event-description",
            attr: {
                "aria-label": `${label} override`,
                placeholder: `Using Settings: ${defaults.join(", ")}`,
            },
        });
        input.rows = 2;
        input.addEventListener("input", () => onChange(normalizeInboxFolders(input.value.split(/\r?\n/))));
    }

    private refreshTarget(updateNotes = true): void {
        const target = this.options.resolveTarget();
        this.targetSummaryEl?.setText(
            target ? `${target.file} · ${target.heading || "No heading"}` : "Selected destination is unavailable",
        );
        if (updateNotes && target) this.notesController?.setTargetFile(target.file);
    }

    private get peopleFolders(): string[] {
        const override = this.options.form.inboxPeopleFoldersOverride;
        return override.length > 0 ? override : this.options.getSettings().inbox.peopleFolders;
    }

    private get placeFolders(): string[] {
        const override = this.options.form.inboxPlaceFoldersOverride;
        return override.length > 0 ? override : this.options.getSettings().inbox.placeFolders;
    }
}
