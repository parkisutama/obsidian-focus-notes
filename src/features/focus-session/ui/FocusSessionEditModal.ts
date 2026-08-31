import { type App, Modal, Notice } from "obsidian";
import type { LedgerRecordSnapshot } from "../../capture/scheduled-item/domain/LedgerRecordSource.ts";
import { editCanonicalFocusSession } from "../../../infrastructure/obsidian/focus-session/CanonicalFocusSessionWriter.ts";
import { EmotionalWellbeingPicker } from "../../reflection/ui/EmotionalWellbeingPicker.ts";
import { ReflectionFocusModal } from "../../reflection/ui/ReflectionFocusModal.ts";
import type { EmotionCategory, StressLevel } from "../../reflection/domain/Wellbeing.ts";
import { ContextNotesController } from "../../capture/moment/ui/InboxNotesController.ts";
import type { ContextSourceSettings } from "../../object-notes/domain/ContextSourceSettings.ts";
import type { ScannedFocusSession } from "../domain/FocusSessionBlockScan.ts";

/**
 * Lets the user add or correct a logged Focus Session's mood/emotion/reflection after the fact —
 * the "Edit Session" counterpart to Event/Task's own manage/edit modal
 * (ScheduledItemDesktopEditModal), scoped to owned sessions since only those have a stable,
 * block-ID-addressable canonical line to hydrate from and write back to.
 *
 * Deliberately doesn't touch start/end/duration/mode — those are tied to when the timer actually
 * ran and aren't editable through any path in this plugin.
 */
export class FocusSessionEditModal extends Modal {
    private stressLevel: StressLevel | null;
    private emotionCategory: EmotionCategory | null;
    private emotionKey: string | null;
    private notes: string;
    private saving = false;
    private notesEditorEl!: HTMLDivElement;
    private notesController: ContextNotesController | null = null;

    constructor(
        app: App,
        private snapshot: LedgerRecordSnapshot,
        private session: ScannedFocusSession,
        private getContextSources: () => ContextSourceSettings[],
        private onComplete: () => void,
    ) {
        super(app);
        this.stressLevel = session.stressLevel;
        this.emotionCategory = session.emotionCategory;
        this.emotionKey = session.emotionKey;
        this.notes = session.notes ?? "";
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("focus-notes-modal");
        contentEl.addClass("focus-notes-modal-wide");

        contentEl.createEl("h2", { text: "Edit Focus Session" });
        contentEl.createDiv({
            cls: "focus-notes-modal-summary",
            text: this.summarizeSession(),
        });

        const wellbeingSection = contentEl.createDiv({ cls: "focus-notes-modal-section" });
        wellbeingSection.createEl("div", { cls: "focus-notes-modal-label", text: "Emotional Wellbeing" });
        new EmotionalWellbeingPicker(
            wellbeingSection,
            (value) => {
                this.stressLevel = value.stressLevel;
                this.emotionCategory = value.emotionCategory;
                this.emotionKey = value.emotionKey;
            },
            { stressLevel: this.stressLevel, emotionCategory: this.emotionCategory, emotionKey: this.emotionKey },
        );

        const reflectionSection = contentEl.createDiv({ cls: "focus-notes-modal-section" });
        const reflectionHead = reflectionSection.createDiv({ cls: "fn-reflection-head" });
        reflectionHead.createDiv({ cls: "focus-notes-modal-label", text: "Reflection and notes" });
        const expandBtn = reflectionHead.createEl("button", { cls: "fn-reflection-expand", text: "Open expanded ↗" });
        this.notesEditorEl = reflectionSection.createDiv({
            cls: "fn-gcal-desc-input fn-reflection-inline-editor",
            attr: {
                role: "textbox",
                "aria-label": "Reflection and notes",
                "aria-multiline": "true",
                "data-placeholder": "What happened? What shifted your stress or emotion? What did you produce?",
            },
        });
        this.notesController = new ContextNotesController(this.app, this.notesEditorEl, {
            initialValue: this.notes,
            targetFile: this.snapshot.filePath,
            getContextSources: this.getContextSources,
            referenceFormat: "markdown-link",
            onChange: (value) => {
                this.notes = value;
            },
        });
        expandBtn.addEventListener("click", (evt) => {
            evt.preventDefault();
            new ReflectionFocusModal(
                this.app,
                this.notes,
                { stressLevel: this.stressLevel, emotionCategory: this.emotionCategory, emotionKey: this.emotionKey },
                { targetFile: this.snapshot.filePath, getContextSources: this.getContextSources },
                (result) => {
                    if (result !== null) this.replaceNotesContent(result);
                },
            ).open();
        });

        const buttons = contentEl.createDiv({ cls: "focus-notes-modal-buttons" });
        const cancel = buttons.createEl("button", { text: "Cancel" });
        cancel.addEventListener("click", () => this.close());
        const save = buttons.createEl("button", { text: "Save", cls: "mod-cta" });
        save.addEventListener("click", () => void this.submit());
    }

    onClose(): void {
        this.notesController?.destroy();
        this.notesController = null;
        this.contentEl.empty();
    }

    /**
     * ContextNotesController has no public "replace value" API — see LogModal's identical
     * helper for the full rationale — so the expanded modal's returned text is applied by
     * tearing down and rebuilding the controller against the same container.
     */
    private replaceNotesContent(value: string): void {
        this.notes = value;
        this.notesController?.destroy();
        this.notesEditorEl.empty();
        this.notesController = new ContextNotesController(this.app, this.notesEditorEl, {
            initialValue: value,
            targetFile: this.snapshot.filePath,
            getContextSources: this.getContextSources,
            referenceFormat: "markdown-link",
            onChange: (next) => {
                this.notes = next;
            },
        });
    }

    private async submit(): Promise<void> {
        if (this.saving) return;
        this.saving = true;
        try {
            const result = await editCanonicalFocusSession(this.app, this.snapshot, this.session.sessionId, {
                stressLevel: this.stressLevel,
                emotionCategory: this.emotionCategory,
                emotionKey: this.emotionKey,
                notes: this.notes,
            });
            if (result.status === "saved") {
                new Notice("Focus Session updated.");
                this.close();
                this.onComplete();
                return;
            }
            if (result.status === "not-found") {
                new Notice("This session could not be found in the note anymore — it may have been removed.");
            } else {
                new Notice("The note changed since this was opened. Reopen and try again.");
            }
        } finally {
            this.saving = false;
        }
    }

    private summarizeSession(): string {
        const label =
            this.session.mode === "stopwatch" ? "Stopwatch" : this.session.mode === "pomodoro" ? "Pomodoro" : "Timer";
        const m = Math.floor(this.session.durationSeconds / 60);
        const s = this.session.durationSeconds % 60;
        const dur = m > 0 ? `${m}m ${s}s` : `${s}s`;
        return `${label} • ${this.session.start} → ${this.session.end} • ${dur}`;
    }
}
