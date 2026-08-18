import { type App, setIcon } from "obsidian";
import type { EventTaskFormState } from "./EventTaskFormState";
import { InboxNotesController } from "./InboxNotesController";
import { FileSuggest } from "./Suggesters";
import type { FocusNotesSettings, FocusTarget, InsertPosition } from "./types";

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
                "aria-label": "Moment notes",
                "data-placeholder": "Capture context. Type @ for contextual notes, # for tags.",
            },
        });
        this.notesController = new InboxNotesController(this.options.app, notesEl, {
            initialValue: this.options.form.inboxBody,
            targetFile: this.options.resolveTarget()?.file ?? "",
            getContextSources: () => this.options.getSettings().inbox.contextSources,
            onChange: (value) => (this.options.form.inboxBody = value),
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
        advanced.createEl("summary", { text: "More options" });
        const fields = advanced.createDiv({ cls: "fn-inbox-advanced-fields" });

        this.targetSummaryEl = fields.createDiv({ cls: "fn-inbox-target-summary" });
        this.refreshTarget(false);

        const fileLabel = fields.createEl("label", { text: "Save to" });
        const file = fileLabel.createEl("input", {
            type: "text",
            attr: {
                placeholder: "Note path",
                "aria-label": "Moment target note",
            },
        });
        file.value = this.options.form.inboxTargetFile;
        file.addEventListener("input", () => {
            this.options.form.inboxTargetFile = file.value;
            this.refreshTarget();
        });
        new FileSuggest(this.options.app, file);

        const headingLabel = fields.createEl("label", { text: "Heading" });
        const heading = headingLabel.createEl("input", {
            type: "text",
            attr: { placeholder: "Moment", "aria-label": "Moment heading" },
        });
        heading.value = this.options.form.inboxHeading;
        heading.addEventListener("input", () => {
            this.options.form.inboxHeading = heading.value;
            this.refreshTarget(false);
        });

        const positionLabel = fields.createEl("label", { text: "Insert position" });
        const position = positionLabel.createEl("select", {
            attr: { "aria-label": "Moment insert position" },
        });
        position.createEl("option", { text: "End of section", value: "end" });
        position.createEl("option", { text: "Start of section", value: "start" });
        position.value = this.options.form.inboxPosition;
        position.addEventListener("change", () => {
            this.options.form.inboxPosition = position.value as InsertPosition;
        });
    }

    private refreshTarget(updateNotes = true): void {
        const target = this.options.resolveTarget();
        this.targetSummaryEl?.setText(
            target ? `${target.file} · ${target.heading || "No heading"}` : "Selected destination is unavailable",
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
