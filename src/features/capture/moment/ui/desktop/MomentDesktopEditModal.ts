import { type App, Modal, Notice } from "obsidian";
import type { ReflectionBlockFields } from "../../../../reflection/domain/ReflectionBlockLine.ts";
import { EmotionalWellbeingPicker } from "../../../../reflection/ui/EmotionalWellbeingPicker.ts";
import { InboxNotesController } from "../InboxNotesController.ts";
import type { MomentBlock } from "../../domain/MomentBlock.ts";
import type { MomentBlockEdit } from "../../domain/MomentBlockEditor.ts";
import {
    saveMomentBlock,
    type SaveMomentBlockResult,
} from "../../../../../infrastructure/obsidian/capture/MomentBlockPersistence.ts";
import type { LedgerRecordSnapshot } from "../../../scheduled-item/domain/LedgerRecordSource.ts";
import type { ContextSourceSettings } from "../../../../object-notes/domain/ContextSourceSettings.ts";

export interface MomentDesktopEditModalOptions {
    app: App;
    snapshot: LedgerRecordSnapshot;
    block: MomentBlock;
    getContextSources(): ContextSourceSettings[];
    onComplete: () => void;
}

/** Edits an existing Moment's Description, wellbeing, and Reflection Notes in place. */
export class MomentDesktopEditModal extends Modal {
    private description: string;
    private reflection: ReflectionBlockFields;
    private reflectionNotes: string;
    private descriptionController: InboxNotesController | null = null;
    private reflectionNotesController: InboxNotesController | null = null;
    private saveButtonEl!: HTMLButtonElement;
    private busy = false;

    constructor(private readonly options: MomentDesktopEditModalOptions) {
        super(options.app);
        this.description = options.block.description;
        this.reflection = { ...options.block.reflection };
        this.reflectionNotes = options.block.reflectionNotes ?? "";
    }

    onOpen(): void {
        this.modalEl.addClass("fn-moment-edit-modal");
        this.render();
    }

    onClose(): void {
        this.descriptionController?.destroy();
        this.descriptionController = null;
        this.reflectionNotesController?.destroy();
        this.reflectionNotesController = null;
        this.contentEl.empty();
    }

    private render(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("fn-gcal-content");

        const descriptionSection = contentEl.createDiv({ cls: "focus-notes-modal-section" });
        descriptionSection.createDiv({ cls: "focus-notes-modal-label", text: "Description" });
        const descriptionEl = descriptionSection.createDiv({
            cls: "fn-inbox-notes-input",
            attr: { role: "textbox", "aria-label": "Moment description" },
        });
        this.descriptionController = new InboxNotesController(this.options.app, descriptionEl, {
            initialValue: this.description,
            targetFile: this.options.snapshot.filePath,
            getContextSources: this.options.getContextSources,
            onChange: (value) => (this.description = value),
        });

        const reflectionSection = contentEl.createDiv({ cls: "focus-notes-modal-section fn-moment-reflection" });
        reflectionSection.createDiv({ cls: "focus-notes-modal-label", text: "Reflection" });
        new EmotionalWellbeingPicker(reflectionSection, (value) => (this.reflection = value), this.reflection);
        reflectionSection.createDiv({ cls: "focus-notes-modal-label", text: "Reflection notes" });
        const reflectionNotesEl = reflectionSection.createDiv({
            cls: "fn-inbox-notes-input",
            attr: { role: "textbox", "aria-label": "Moment reflection notes" },
        });
        this.reflectionNotesController = new InboxNotesController(this.options.app, reflectionNotesEl, {
            initialValue: this.reflectionNotes,
            targetFile: this.options.snapshot.filePath,
            getContextSources: this.options.getContextSources,
            onChange: (value) => (this.reflectionNotes = value),
        });

        const footer = contentEl.createDiv({ cls: "fn-gcal-footer" });
        const cancel = footer.createEl("button", {
            cls: "fn-gcal-btn-discard",
            text: "Cancel",
            attr: { type: "button" },
        });
        cancel.addEventListener("click", () => this.close());
        const save = footer.createEl("button", {
            cls: "fn-gcal-btn-save mod-cta",
            text: "Save",
            attr: { type: "button" },
        });
        this.saveButtonEl = save;
        save.addEventListener("click", () => void this.submit());
    }

    private async submit(): Promise<void> {
        if (this.busy) return;
        this.busy = true;
        this.saveButtonEl.disabled = true;
        this.saveButtonEl.setText("Saving…");
        try {
            const edit: MomentBlockEdit = {
                description: this.description,
                reflection: this.reflection,
                reflectionNotes: this.reflectionNotes,
            };
            const result = await saveMomentBlock(this.options.app, this.options.snapshot, edit);
            if (result.status === "conflict" || result.status === "invalid") {
                new Notice(momentEditFailureMessage(result));
                return;
            }
            this.options.onComplete();
            this.close();
        } finally {
            this.busy = false;
            this.saveButtonEl.disabled = false;
            this.saveButtonEl.setText("Save");
        }
    }
}

function momentEditFailureMessage(result: Exclude<SaveMomentBlockResult, { status: "saved" | "unchanged" }>): string {
    if (result.status === "invalid") return "This Moment block is ambiguous or invalid and cannot be saved.";
    return "This Moment's source changed or moved. Reopen and try again.";
}
