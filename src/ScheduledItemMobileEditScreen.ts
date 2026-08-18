import { type App, Component, Notice } from "obsidian";
import {
    type DetailNotePromotionResult,
    promoteScheduledItemDetail,
    retryDetailNoteAttachment,
} from "./DetailNotePromotion.ts";
import { EventTaskWriter, type HubNoteRef } from "./EventTaskWriter.ts";
import type { LedgerRecordSnapshot } from "./LedgerRecordSource.ts";
import { MobileScheduledItemForm } from "./MobileScheduledItemForm.ts";
import { readContextSuggestionNotes } from "./ObsidianInboxSuggestionSource.ts";
import { createObsidianLinkResolver } from "./ObsidianLinkResolver.ts";
import { saveScheduledItemBlock } from "./ScheduledItemBlockPersistence.ts";
import {
    retryScheduledItemEditRelated,
    type ScheduledItemEditSubmissionResult,
    submitScheduledItemEdit,
} from "./ScheduledItemEditSubmission.ts";
import { hydrateScheduledItemFormEdit } from "./ScheduledItemFormAdapter.ts";
import type { ScheduledItemFormData } from "./ScheduledItemFormData.ts";
import type { FocusNotesSettings } from "./types.ts";
import { isTFile } from "./utils.ts";

type PartialDetail = Extract<DetailNotePromotionResult, { status: "partial" }>;
type PartialRelated = Extract<ScheduledItemEditSubmissionResult, { status: "partial" }>;

export class ScheduledItemMobileEditScreen extends Component {
    private readonly original: ScheduledItemFormData;
    private readonly data: ScheduledItemFormData;
    private renderer: MobileScheduledItemForm | null = null;
    private pendingDetail: PartialDetail | null = null;
    private pendingRelated: PartialRelated | null = null;
    private latestEditResult: ScheduledItemEditSubmissionResult | null = null;
    private busy = false;
    private completionNotified = false;
    private opened = false;

    constructor(
        private readonly app: App,
        private readonly getSettings: () => FocusNotesSettings,
        private readonly snapshot: LedgerRecordSnapshot,
        kind: "task" | "event",
        title: string,
        private readonly onComplete: () => void,
    ) {
        super();
        const hydrated = hydrateScheduledItemFormEdit({ kind, title, snapshot });
        if (hydrated.status === "invalid") throw new Error(`Cannot edit Scheduled Item: ${hydrated.reason}`);
        this.original = cloneData(hydrated.data);
        this.data = cloneData(hydrated.data);
    }

    open(): void {
        if (this.opened) return;
        this.opened = true;
        this.load();
        this.renderer = new MobileScheduledItemForm({
            app: this.app,
            mode: "edit",
            data: this.data,
            contextLabel: `${this.snapshot.filePath} · Line ${this.snapshot.lineNumber}`,
            targetFile: this.snapshot.filePath,
            defaultDetailNotesFolder: this.getSettings().eventTask.detailNotesFolder,
            getContextSources: () => this.getSettings().inbox.contextSources,
            onChange: () => undefined,
            onSubmit: () => void this.submit(),
            onCancel: () => this.close(),
        });
        this.renderer.open(this);
    }

    close(): void {
        if (!this.opened) return;
        this.opened = false;
        this.unload();
    }

    onunload(): void {
        this.renderer = null;
    }

    private async submit(): Promise<void> {
        if (this.busy) return;
        this.setBusy(true);
        try {
            if (this.pendingRelated) await this.retryRelated();
            else if (this.pendingDetail) await this.retryDetail();
            else await this.promoteAndAttach();
        } finally {
            this.setBusy(false);
        }
    }

    private async promoteAndAttach(): Promise<void> {
        const writer = new EventTaskWriter(this.app, this.getSettings().eventTask);
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
        } else if (result.status === "failure") this.showResult(result.message, false);
        else this.finishLatestEdit();
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
        });
        this.latestEditResult = result;
        if (result.status === "failure") throw new Error(result.message);
    }

    private async retryDetail(): Promise<void> {
        const pending = this.pendingDetail;
        if (!pending) return;
        const writer = new EventTaskWriter(this.app, this.getSettings().eventTask);
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
        const writer = new EventTaskWriter(this.app, this.getSettings().eventTask);
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
        if (result?.status === "partial") {
            this.pendingRelated = result;
            this.notifyCompletion();
            this.showResult(result.message, false);
        } else if (result?.status === "failure") this.showResult(result.message, false);
        else this.showResult(result?.message ?? "Scheduled Item updated.", true);
    }

    private showResult(message: string, complete: boolean): void {
        new Notice(message);
        if (complete) {
            this.notifyCompletion();
            this.close();
        } else {
            this.renderer?.setSubmissionState({ busy: false, recovery: true, errorMessage: message });
        }
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
