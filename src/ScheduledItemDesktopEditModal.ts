import { type App, Modal, Notice } from "obsidian";
import { DesktopScheduledItemForm } from "./DesktopScheduledItemForm.ts";
import {
    type DetailNotePromotionResult,
    promoteScheduledItemDetail,
    retryDetailNoteAttachment,
} from "./DetailNotePromotion.ts";
import { EventTaskWriter, type HubNoteRef } from "./EventTaskWriter";
import type { LedgerRecordSnapshot } from "./LedgerRecordSource.ts";
import { readContextSuggestionNotes } from "./ObsidianInboxSuggestionSource";
import { createObsidianLinkResolver } from "./ObsidianLinkResolver.ts";
import { saveScheduledItemBlock } from "./ScheduledItemBlockPersistence.ts";
import {
    retryScheduledItemEditRelated,
    type ScheduledItemEditSubmissionResult,
    submitScheduledItemEdit,
} from "./ScheduledItemEditSubmission.ts";
import { hydrateScheduledItemFormEdit, parseLocalDateTime } from "./ScheduledItemFormAdapter.ts";
import type { ScheduledItemFormData } from "./ScheduledItemFormData.ts";
import { TargetResolver } from "./TargetResolver.ts";
import type { FocusNotesSettings } from "./types";
import { isTFile } from "./utils.ts";

type PartialDetail = Extract<DetailNotePromotionResult, { status: "partial" }>;
type PartialRelated = Extract<ScheduledItemEditSubmissionResult, { status: "partial" }>;

export class ScheduledItemDesktopEditModal extends Modal {
    private readonly original: ScheduledItemFormData;
    private readonly data: ScheduledItemFormData;
    private renderer: DesktopScheduledItemForm | null = null;
    private pendingDetail: PartialDetail | null = null;
    private pendingRelated: PartialRelated | null = null;
    private latestEditResult: ScheduledItemEditSubmissionResult | null = null;
    private busy = false;
    private completionNotified = false;

    constructor(
        app: App,
        private readonly getSettings: () => FocusNotesSettings,
        private readonly snapshot: LedgerRecordSnapshot,
        kind: "task" | "event",
        title: string,
        private readonly onComplete: () => void,
    ) {
        super(app);
        const hydrated = hydrateScheduledItemFormEdit({ kind, title, snapshot });
        if (hydrated.status === "invalid") throw new Error(`Cannot edit Scheduled Item: ${hydrated.reason}`);
        this.original = cloneData(hydrated.data);
        this.data = cloneData(hydrated.data);
    }

    onOpen(): void {
        this.modalEl.addClass("fn-scheduled-item-edit-modal");
        this.render();
    }

    onClose(): void {
        this.renderer?.destroy();
        this.renderer = null;
        this.contentEl.empty();
    }

    private render(): void {
        this.renderer?.destroy();
        this.renderer = new DesktopScheduledItemForm({
            app: this.app,
            mode: "edit",
            data: this.data,
            contextLabel: `${this.snapshot.filePath} · Line ${this.snapshot.lineNumber}`,
            targetFile: this.snapshot.filePath,
            defaultDetailNotesFolder: new TargetResolver(this.app, this.getSettings()).getDetailNotesFolder(
                this.snapshot.filePath,
            ),
            getContextSources: () => this.getSettings().inbox.contextSources,
            onChange: () => undefined,
            onSubmit: () => void this.submit(),
            onCancel: () => this.close(),
        });
        this.renderer.render(this.contentEl);
    }

    private async submit(): Promise<void> {
        if (this.busy) return;
        this.setBusy(true);
        try {
            if (this.pendingRelated) {
                await this.retryRelated();
                return;
            }
            if (this.pendingDetail) {
                await this.retryDetail();
                return;
            }
            await this.promoteAndAttach();
        } finally {
            this.setBusy(false);
        }
    }

    private async promoteAndAttach(): Promise<void> {
        const writer = new EventTaskWriter(this.app, this.getSettings().eventTask, () => this.getSettings());
        this.latestEditResult = null;
        const result = await promoteScheduledItemDetail(this.data, {
            targetPath: this.snapshot.filePath,
            findDetailNote: (path) => {
                const file = this.app.vault.getAbstractFileByPath(path);
                return isTFile(file) ? file : null;
            },
            createDetailNote: (name, record, folder, targetPath, hubPath) =>
                writer.createDetailNote(name, record, folder, targetPath, hubPath),
            attachDetail: (attachment) => this.attachAndWrite(writer, attachment),
        });
        if (result.status === "partial") {
            this.pendingDetail = result;
            this.showResult(result.message, false);
            return;
        }
        if (result.status === "failure") {
            this.showResult(result.message, false);
            return;
        }
        this.finishLatestEdit();
    }

    private async attachAndWrite(writer: EventTaskWriter, attachment: HubNoteRef | null): Promise<void> {
        const next = cloneData(this.data);
        next.detailNote = attachment ? { mode: "link", path: attachment.path } : { mode: "none" };
        const result = await submitScheduledItemEdit(this.original, next, this.snapshot, {
            contextNotes: readContextSuggestionNotes(this.app),
            contextSources: this.getSettings().inbox.contextSources,
            writePrimary: async (edit) => {
                const saved = await saveScheduledItemBlock(this.app, this.snapshot, edit);
                if (saved.status === "conflict") throw new Error("source changed or moved");
                if (saved.status === "invalid") throw new Error("source block is ambiguous or invalid");
            },
            writeRelated: (request) =>
                writer.writeRelated(request.markdown, request.destinationPath, request.heading, request.position),
            resolveLinkDestination: createObsidianLinkResolver(this.app),
            formatDateValue: (value) => {
                const when = parseLocalDateTime(value, true);
                return when ? writer.formatDailyLink(when, this.snapshot.filePath, value) : value;
            },
        });
        this.latestEditResult = result;
        if (result.status === "failure") throw new Error(result.message);
    }

    private async retryDetail(): Promise<void> {
        const pending = this.pendingDetail;
        if (!pending) return;
        const writer = new EventTaskWriter(this.app, this.getSettings().eventTask, () => this.getSettings());
        this.latestEditResult = null;
        const result = await retryDetailNoteAttachment(pending, (attachment) =>
            this.attachAndWrite(writer, attachment),
        );
        if (result.status === "partial") {
            this.pendingDetail = result;
            this.showResult(result.message, false);
            return;
        }
        this.pendingDetail = null;
        this.finishLatestEdit();
    }

    private async retryRelated(): Promise<void> {
        const pending = this.pendingRelated;
        if (!pending) return;
        const writer = new EventTaskWriter(this.app, this.getSettings().eventTask, () => this.getSettings());
        const result = await retryScheduledItemEditRelated(pending, (request) =>
            writer.writeRelated(request.markdown, request.destinationPath, request.heading, request.position),
        );
        if (result.status === "partial") {
            this.pendingRelated = result;
            this.showResult(result.message, false);
            return;
        }
        this.pendingRelated = null;
        this.showResult(result.message, true);
    }

    private finishLatestEdit(): void {
        const result = this.latestEditResult;
        if (!result) {
            this.showResult("Scheduled Item updated.", true);
            return;
        }
        if (result.status === "partial") {
            this.pendingRelated = result;
            this.notifyCompletion();
            this.showResult(result.message, false);
            return;
        }
        if (result.status === "failure") {
            this.showResult(result.message, false);
            return;
        }
        this.showResult(result.message, true);
    }

    private showResult(message: string, complete: boolean): void {
        new Notice(message);
        if (!complete) {
            this.renderer?.setSubmissionState({
                busy: false,
                recovery: this.pendingDetail !== null || this.pendingRelated !== null,
                errorMessage: message,
            });
            return;
        }
        this.notifyCompletion();
        this.close();
    }

    private notifyCompletion(): void {
        if (this.completionNotified) return;
        this.completionNotified = true;
        this.onComplete();
    }

    private setBusy(busy: boolean): void {
        this.busy = busy;
        this.renderer?.setSubmissionState({
            busy,
            recovery: this.pendingDetail !== null || this.pendingRelated !== null,
        });
    }
}

function cloneData(data: ScheduledItemFormData): ScheduledItemFormData {
    return JSON.parse(JSON.stringify(data)) as ScheduledItemFormData;
}
