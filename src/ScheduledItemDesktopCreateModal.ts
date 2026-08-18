import { type App, Modal, Notice } from "obsidian";
import { type DesktopScheduledItemCreateContext, DesktopScheduledItemForm } from "./DesktopScheduledItemForm.ts";
import {
    type DetailNotePromotionResult,
    promoteScheduledItemDetail,
    retryDetailNoteAttachment,
} from "./DetailNotePromotion.ts";
import { EventTaskFormState } from "./EventTaskFormState";
import { EventTaskWriter, type HubNoteRef } from "./EventTaskWriter";
import { readContextSuggestionNotes } from "./ObsidianInboxSuggestionSource";
import { createObsidianLinkResolver } from "./ObsidianLinkResolver.ts";
import {
    retryScheduledItemCreateRelated,
    type ScheduledItemCreateRelatedResult,
    writeScheduledItemCreateRelated,
} from "./ScheduledItemCreateRelated.ts";
import { buildScheduledItemRecord } from "./ScheduledItemFormAdapter.ts";
import { type ScheduledItemFormData, scheduledItemFormDataFromCreateState } from "./ScheduledItemFormData.ts";
import { TargetResolver } from "./TargetResolver";
import type { FocusNotesSettings, FocusTarget } from "./types";
import { isTFile } from "./utils.ts";

type PartialDetail = Extract<DetailNotePromotionResult, { status: "partial" }>;
type PartialRelated = Extract<ScheduledItemCreateRelatedResult, { status: "partial" }>;

export class ScheduledItemDesktopCreateModal extends Modal {
    private readonly data: ScheduledItemFormData;
    private readonly context: DesktopScheduledItemCreateContext;
    private renderer: DesktopScheduledItemForm | null = null;
    private pendingDetail: PartialDetail | null = null;
    private pendingRelated: PartialRelated | null = null;
    private primaryPath: string | null = null;
    private busy = false;
    private completionNotified = false;

    constructor(
        app: App,
        private readonly getSettings: () => FocusNotesSettings,
        anchorDate: Date,
        kind: "task" | "event",
        target: FocusTarget,
        private readonly onComplete: () => void,
    ) {
        super(app);
        const settings = getSettings();
        const state = new EventTaskFormState(anchorDate, {
            file: target.file,
            heading: target.heading,
            position: target.position,
            hubNotesFolder: settings.eventTask.hubNotesFolder,
            detailNotesFolder: settings.eventTask.detailNotesFolder,
        });
        state.kind = kind;
        this.data = scheduledItemFormDataFromCreateState(state);
        this.context = { targetFile: target.file, targetHeading: target.heading, targetPosition: target.position };
    }

    onOpen(): void {
        this.modalEl.addClass("fn-scheduled-item-create-modal");
        this.renderer = new DesktopScheduledItemForm({
            app: this.app,
            mode: "create",
            data: this.data,
            contextLabel: `${this.context.targetFile} · ${this.context.targetHeading || "No heading"}`,
            targetFile: this.context.targetFile,
            createContext: this.context,
            defaultDetailNotesFolder: new TargetResolver(this.app, this.getSettings()).getDetailNotesFolder(
                this.context.targetFile,
            ),
            getContextSources: () => this.getSettings().inbox.contextSources,
            onChange: () => undefined,
            onSubmit: () => void this.submit(),
            onCancel: () => this.close(),
        });
        this.renderer.render(this.contentEl);
    }

    onClose(): void {
        this.renderer?.destroy();
        this.renderer = null;
        this.contentEl.empty();
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
            if (!this.context.targetFile.trim()) {
                this.showResult("Please select a target file.", false);
                return;
            }
            await this.promoteAndWrite();
        } finally {
            this.setBusy(false);
        }
    }

    private async promoteAndWrite(): Promise<void> {
        const writer = new EventTaskWriter(this.app, this.getSettings().eventTask);
        const targetPath = this.resolvePrimaryTarget();
        if (!targetPath) {
            this.showResult("Scheduled Item fields are invalid.", false);
            return;
        }
        const result = await promoteScheduledItemDetail(this.data, {
            targetPath,
            findDetailNote: (path) => {
                const file = this.app.vault.getAbstractFileByPath(path);
                return isTFile(file) ? file : null;
            },
            createDetailNote: (name, record, folder, targetPath, hubPath) =>
                writer.createDetailNote(name, record, folder, targetPath, hubPath),
            attachDetail: (attachment) => this.writePrimary(writer, attachment),
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
        await this.writeRelated(writer);
    }

    private async writePrimary(writer: EventTaskWriter, attachment: HubNoteRef | null): Promise<void> {
        const built = buildScheduledItemRecord(this.data);
        if (built.status === "invalid") throw new Error(built.message);
        const targetPath = this.resolvePrimaryTarget();
        if (!targetPath) throw new Error("Scheduled Item fields are invalid.");
        await writer.write(
            built.record,
            targetPath,
            this.context.targetHeading.trim(),
            this.context.targetPosition,
            attachment,
        );
        this.primaryPath = targetPath;
    }

    private resolvePrimaryTarget(): string | null {
        const built = buildScheduledItemRecord(this.data);
        if (built.status === "invalid") return null;
        const when =
            built.record.kind === "event"
                ? built.record.start
                : (built.record.due ?? built.record.timebox?.start ?? new Date());
        return new TargetResolver(this.app, this.getSettings()).resolve(
            {
                file: this.context.targetFile.trim(),
                heading: this.context.targetHeading.trim(),
                position: this.context.targetPosition,
            },
            when,
        ).file;
    }

    private async retryDetail(): Promise<void> {
        const pending = this.pendingDetail;
        if (!pending) return;
        const writer = new EventTaskWriter(this.app, this.getSettings().eventTask);
        const result = await retryDetailNoteAttachment(pending, (attachment) => this.writePrimary(writer, attachment));
        if (result.status === "partial") {
            this.pendingDetail = result;
            this.showResult(result.message, false);
            return;
        }
        this.pendingDetail = null;
        await this.writeRelated(writer);
    }

    private async writeRelated(writer: EventTaskWriter): Promise<void> {
        const primaryPath = this.primaryPath;
        if (!primaryPath) {
            this.showResult("Primary Scheduled Item was not written.", false);
            return;
        }
        const result = await writeScheduledItemCreateRelated(this.data, primaryPath, {
            contextNotes: readContextSuggestionNotes(this.app),
            contextSources: this.getSettings().inbox.contextSources,
            writeRelated: (request) =>
                writer.writeRelated(request.markdown, request.destinationPath, request.heading, request.position),
            resolveLinkDestination: createObsidianLinkResolver(this.app),
        });
        if (result.status === "partial") {
            this.pendingRelated = result;
            this.notifyCompletion();
            this.showResult(result.message, false);
            return;
        }
        this.showResult(result.message, true);
    }

    private async retryRelated(): Promise<void> {
        const pending = this.pendingRelated;
        if (!pending) return;
        const writer = new EventTaskWriter(this.app, this.getSettings().eventTask);
        const result = await retryScheduledItemCreateRelated(pending, (request) =>
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
