import { type App, Modal, Notice } from "obsidian";
import { DesktopScheduledItemForm } from "./DesktopScheduledItemForm.ts";
import {
    type DetailNotePromotionResult,
    promoteScheduledItemDetail,
    retryDetailNoteAttachment,
} from "../../application/DetailNotePromotion.ts";
import { EventTaskWriter } from "../../../../../infrastructure/obsidian/capture/EventTaskWriter";
import type { HubNoteRef } from "../../domain/EventTaskRecord";
import type { LedgerRecordSnapshot } from "../../domain/LedgerRecordSource.ts";
import { readContextSuggestionNotes } from "../../../../../infrastructure/obsidian/suggestions/ObsidianInboxSuggestionSource";
import {
    createObsidianLinkFormatter,
    createObsidianLinkResolver,
} from "../../../../../infrastructure/obsidian/suggestions/ObsidianLinkResolver.ts";
import { saveScheduledItemBlock } from "../../../../../infrastructure/obsidian/capture/ScheduledItemBlockPersistence.ts";
import { TargetResolver } from "../../../../../infrastructure/obsidian/capture/TargetResolver.ts";
import {
    runEventDayProjection,
    retryEventDayProjectionRuntime,
} from "../../../../../infrastructure/obsidian/capture/EventDayProjectionRuntime.ts";
import {
    runTaskDayProjection,
    retryTaskDayProjectionRuntime,
} from "../../../../../infrastructure/obsidian/capture/TaskDayProjectionRuntime.ts";
import { TimeboxManagerModal } from "./TimeboxManagerModal.ts";
import {
    scanFocusSessionsInBlock,
    type ScannedFocusSession,
} from "../../../../focus-session/domain/FocusSessionBlockScan.ts";
import { FocusSessionEditModal } from "../../../../focus-session/ui/FocusSessionEditModal.ts";
import {
    retryScheduledItemEditRelated,
    type ScheduledItemEditSubmissionResult,
    submitScheduledItemEdit,
} from "../../application/ScheduledItemEditSubmission.ts";
import type { EventDayProjectionResult } from "../../application/EventDayProjection.ts";
import { touchedDayKeysFromEventFormFields } from "../../application/EventDayProjection.ts";
import type { TaskDayProjectionResult } from "../../application/TaskDayProjection.ts";
import { planTaskDayReferences, type TaskDayReferenceTimebox } from "../../domain/TaskDayReferencePlan.ts";
import { extractScheduledItemBlockId } from "../../domain/ScheduledItemBlockId.ts";
import { parseScheduledItemBlock } from "../../domain/ScheduledItemBlockEditor.ts";
import { hydrateScheduledItemFormEdit, parseLocalDateTime } from "../../domain/ScheduledItemFormAdapter.ts";
import type { ScheduledItemFormData } from "../../domain/ScheduledItemFormData.ts";
import {
    formatScheduledItemFocusSummary,
    summarizeScheduledItemFocus,
} from "../../domain/ScheduledItemFocusSummary.ts";
import type { FocusNotesSettings } from "../../../../settings/domain/FocusNotesSettings";
import { isTFile } from "../../../../../infrastructure/obsidian/vault/ObsidianFileTypes.ts";

type PartialDetail = Extract<DetailNotePromotionResult, { status: "partial" }>;
type PartialRelated = Extract<ScheduledItemEditSubmissionResult, { status: "partial" }>;
type PartialDayProjection = Extract<EventDayProjectionResult, { status: "partial" }>;
type PartialTaskDayProjection = Extract<TaskDayProjectionResult, { status: "partial" }>;

export class ScheduledItemDesktopEditModal extends Modal {
    private readonly original: ScheduledItemFormData;
    private readonly data: ScheduledItemFormData;
    private renderer: DesktopScheduledItemForm | null = null;
    private pendingDetail: PartialDetail | null = null;
    private pendingDayProjection: PartialDayProjection | null = null;
    private pendingTaskDayProjection: PartialTaskDayProjection | null = null;
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
            onManageTimeboxes: this.data.kind === "task" ? () => this.openTimeboxManager() : undefined,
            focusSessions: scanFocusSessionsInBlock(this.snapshot.rawBlock),
            onEditFocusSession: (session) => this.openFocusSessionEdit(session),
            focusSummary: formatScheduledItemFocusSummary(this.computeFocusSummary()),
        });
        this.renderer.render(this.contentEl);
    }

    /**
     * Focus Sessions persist directly to the vault from their own modal, same rationale as
     * openTimeboxManager: close this Edit modal first rather than risk a later "Save" here
     * overwriting the session edit with stale in-memory state.
     */
    private openFocusSessionEdit(session: ScannedFocusSession): void {
        const onComplete = this.onComplete;
        const snapshot = this.snapshot;
        const getSettings = this.getSettings;
        this.close();
        new FocusSessionEditModal(
            this.app,
            snapshot,
            session,
            () => getSettings().inbox.contextSources,
            onComplete,
        ).open();
    }

    /**
     * Timeboxes persist directly to the vault from their own modal (Task 34's service), so this
     * Edit modal closes first rather than risk overwriting that change with its own stale state.
     */
    private openTimeboxManager(): void {
        if (this.data.kind !== "task") return;
        const due = this.data.due ? { date: this.data.due, hasTime: this.data.due.includes(" ") } : null;
        const { title, completed } = this.data;
        const onComplete = this.onComplete;
        this.close();
        new TimeboxManagerModal(
            this.app,
            this.getSettings,
            { snapshot: this.snapshot, title, completed, due },
            onComplete,
        ).open();
    }

    private async submit(): Promise<void> {
        if (this.busy) return;
        this.setBusy(true);
        try {
            if (this.pendingRelated) {
                await this.retryRelated();
                return;
            }
            if (this.pendingDayProjection) {
                await this.retryDayProjection();
                return;
            }
            if (this.pendingTaskDayProjection) {
                await this.retryTaskDayProjection();
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
            formatSourceLink: createObsidianLinkFormatter(this.app),
            formatDateValue: (value) => {
                const when = parseLocalDateTime(value, true);
                return when ? writer.formatDailyLink(when, this.snapshot.filePath, value) : value;
            },
        });
        this.latestEditResult = result;
        if (result.status === "failure") throw new Error(result.message);
        await this.writeEventDayProjection(writer);
        await this.writeTaskDayProjection(writer);
    }

    /** Reconciles due/timebox Task references against the due date this edit just saved. */
    private async writeTaskDayProjection(writer: EventTaskWriter): Promise<void> {
        if (this.data.kind !== "task" || this.original.kind !== "task") return;
        const canonicalBlockId = extractScheduledItemBlockId(this.snapshot.rawLine).blockId;
        if (!canonicalBlockId) return;
        const timeboxes = this.currentTaskTimeboxes();
        const settings = this.getSettings();
        const previousDueDayKey = this.original.due ? this.original.due.slice(0, 10) : null;
        const result = await runTaskDayProjection(
            this.app,
            settings,
            {
                title: this.data.title,
                completed: this.data.completed,
                dueDayKey: this.data.due ? this.data.due.slice(0, 10) : null,
                timeboxes,
                canonicalFilePath: this.snapshot.filePath,
                canonicalBlockId,
                heading: settings.captureTask.heading,
                position: settings.captureTask.position,
            },
            planTaskDayReferences(previousDueDayKey, timeboxes),
            writer,
            this.original.completed,
        );
        if (result.status === "partial") this.pendingTaskDayProjection = result;
    }

    /** Reads the Task's current child timeboxes straight from the not-yet-modified snapshot. */
    private currentTaskTimeboxes(): TaskDayReferenceTimebox[] {
        const parsed = parseScheduledItemBlock(this.snapshot.rawBlock);
        if (parsed.status !== "parsed") return [];
        return parsed.block.timeboxes.flatMap((timebox) => {
            const start = parseLocalDateTime(timebox.start, false);
            const end = parseLocalDateTime(timebox.end, false);
            return start && end ? [{ timeboxId: timebox.timeboxId, start, end }] : [];
        });
    }

    /**
     * Task 64: reads the same not-yet-modified snapshot Focus Sessions/Timeboxes already come
     * from — never a second calculation path, and never writes anything back to the block.
     */
    private computeFocusSummary() {
        const sessions = scanFocusSessionsInBlock(this.snapshot.rawBlock);
        if (this.data.kind === "task") {
            const parsed = parseScheduledItemBlock(this.snapshot.rawBlock);
            const timeboxes =
                parsed.status === "parsed"
                    ? parsed.block.timeboxes.flatMap((timebox) => {
                          const start = parseLocalDateTime(timebox.start, false);
                          const end = parseLocalDateTime(timebox.end, false);
                          return start && end ? [{ start, end, status: timebox.status }] : [];
                      })
                    : [];
            return summarizeScheduledItemFocus({ kind: "task", start: null, end: null, allDay: false }, timeboxes, sessions);
        }
        const start = parseLocalDateTime(this.data.start, this.data.allDay);
        const end = !this.data.allDay && this.data.end ? parseLocalDateTime(this.data.end, false) : null;
        return summarizeScheduledItemFocus({ kind: "event", start, end, allDay: this.data.allDay }, [], sessions);
    }

    private async retryTaskDayProjection(): Promise<void> {
        const pending = this.pendingTaskDayProjection;
        if (!pending) return;
        const writer = new EventTaskWriter(this.app, this.getSettings().eventTask, () => this.getSettings());
        const result = await retryTaskDayProjectionRuntime(this.app, this.getSettings(), pending, writer);
        this.pendingTaskDayProjection = result.status === "partial" ? result : null;
        this.showResult(
            result.status === "partial" ? result.message : "Scheduled Item updated.",
            result.status !== "partial",
        );
    }

    /** Reconciles multi-day Event references against the dates this edit just saved. */
    private async writeEventDayProjection(writer: EventTaskWriter): Promise<void> {
        if (this.data.kind !== "event") return;
        const canonicalBlockId = extractScheduledItemBlockId(this.snapshot.rawLine).blockId;
        const start = parseLocalDateTime(this.data.start, this.data.allDay);
        if (!canonicalBlockId || !start) return;
        const end = !this.data.allDay && this.data.end ? parseLocalDateTime(this.data.end, false) : null;
        const settings = this.getSettings();
        const previousTouchedDayKeys =
            this.original.kind === "event"
                ? touchedDayKeysFromEventFormFields(this.original.start, this.original.end, this.original.allDay)
                : [];
        const result = await runEventDayProjection(
            this.app,
            settings,
            {
                title: this.data.title,
                start,
                end,
                allDay: this.data.allDay,
                canonicalFilePath: this.snapshot.filePath,
                canonicalBlockId,
                heading: settings.captureEvent.heading,
                position: settings.captureEvent.position,
            },
            previousTouchedDayKeys,
            writer,
        );
        if (result.status === "partial") this.pendingDayProjection = result;
    }

    private async retryDayProjection(): Promise<void> {
        const pending = this.pendingDayProjection;
        if (!pending) return;
        const writer = new EventTaskWriter(this.app, this.getSettings().eventTask, () => this.getSettings());
        const result = await retryEventDayProjectionRuntime(this.app, this.getSettings(), pending, writer);
        this.pendingDayProjection = result.status === "partial" ? result : null;
        this.showResult(
            result.status === "partial" ? result.message : "Scheduled Item updated.",
            result.status !== "partial",
        );
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
        if (result?.status === "partial") {
            this.pendingRelated = result;
            this.notifyCompletion();
            this.showResult(result.message, false);
            return;
        }
        if (result?.status === "failure") {
            this.showResult(result.message, false);
            return;
        }
        if (this.pendingDayProjection) {
            this.notifyCompletion();
            this.showResult(this.pendingDayProjection.message, false);
            return;
        }
        if (this.pendingTaskDayProjection) {
            this.notifyCompletion();
            this.showResult(this.pendingTaskDayProjection.message, false);
            return;
        }
        this.showResult(result?.message ?? "Scheduled Item updated.", true);
    }

    private showResult(message: string, complete: boolean): void {
        new Notice(message);
        if (!complete) {
            this.renderer?.setSubmissionState({
                busy: false,
                recovery: this.hasPendingRecovery(),
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

    private hasPendingRecovery(): boolean {
        return (
            this.pendingDetail !== null ||
            this.pendingDayProjection !== null ||
            this.pendingTaskDayProjection !== null ||
            this.pendingRelated !== null
        );
    }

    private setBusy(busy: boolean): void {
        this.busy = busy;
        this.renderer?.setSubmissionState({
            busy,
            recovery: this.hasPendingRecovery(),
        });
    }
}

function cloneData(data: ScheduledItemFormData): ScheduledItemFormData {
    return JSON.parse(JSON.stringify(data)) as ScheduledItemFormData;
}
