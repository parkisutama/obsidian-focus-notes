import { type App, Modal, Notice } from "obsidian";
import { resolveAllowedTaskSources } from "../../../../object-notes/application/ContextSourceSettings.ts";
import { type DesktopScheduledItemCreateContext, DesktopScheduledItemForm } from "./DesktopScheduledItemForm.ts";
import {
    type DetailNotePromotionResult,
    promoteScheduledItemDetail,
    retryDetailNoteAttachment,
} from "../../application/DetailNotePromotion.ts";
import { EventTaskFormState } from "../../../domain/EventTaskFormState";
import { EventTaskWriter } from "../../../../../infrastructure/obsidian/capture/EventTaskWriter";
import type { HubNoteRef } from "../../domain/EventTaskRecord";
import { readContextSuggestionNotes } from "../../../../../infrastructure/obsidian/suggestions/ObsidianInboxSuggestionSource";
import {
    createObsidianLinkFormatter,
    createObsidianLinkResolver,
} from "../../../../../infrastructure/obsidian/suggestions/ObsidianLinkResolver.ts";
import { TargetResolver } from "../../../../../infrastructure/obsidian/capture/TargetResolver";
import {
    runEventDayProjection,
    retryEventDayProjectionRuntime,
} from "../../../../../infrastructure/obsidian/capture/EventDayProjectionRuntime.ts";
import {
    runTaskDayProjection,
    retryTaskDayProjectionRuntime,
} from "../../../../../infrastructure/obsidian/capture/TaskDayProjectionRuntime.ts";
import { resolveEventCaptureTarget } from "../../application/ScheduledItemCaptureTarget.ts";
import type { EventDayProjectionResult } from "../../application/EventDayProjection.ts";
import type { TaskDayProjectionResult } from "../../application/TaskDayProjection.ts";
import {
    retryScheduledItemCreateRelated,
    type ScheduledItemCreateRelatedResult,
    writeScheduledItemCreateRelated,
} from "../../application/ScheduledItemCreateRelated.ts";
import { buildScheduledItemRecord, parseLocalDateTime } from "../../domain/ScheduledItemFormAdapter.ts";
import {
    type ScheduledItemFormData,
    scheduledItemFormDataFromCreateState,
} from "../../domain/ScheduledItemFormData.ts";
import type { FocusNotesSettings } from "../../../../settings/domain/FocusNotesSettings";
import type { FocusTarget } from "../../../domain/CaptureTarget";
import { isTFile } from "../../../../../infrastructure/obsidian/vault/ObsidianFileTypes.ts";

type PartialDetail = Extract<DetailNotePromotionResult, { status: "partial" }>;
type PartialRelated = Extract<ScheduledItemCreateRelatedResult, { status: "partial" }>;
type PartialDayProjection = Extract<EventDayProjectionResult, { status: "partial" }>;
type PartialTaskDayProjection = Extract<TaskDayProjectionResult, { status: "partial" }>;

export class ScheduledItemDesktopCreateModal extends Modal {
    private readonly data: ScheduledItemFormData;
    private readonly context: DesktopScheduledItemCreateContext;
    private renderer: DesktopScheduledItemForm | null = null;
    private pendingDetail: PartialDetail | null = null;
    private pendingDayProjection: PartialDayProjection | null = null;
    private pendingTaskDayProjection: PartialTaskDayProjection | null = null;
    private pendingRelated: PartialRelated | null = null;
    private primaryPath: string | null = null;
    private primaryBlockId: string | null = null;
    private busy = false;
    private completionNotified = false;

    constructor(
        app: App,
        private readonly getSettings: () => FocusNotesSettings,
        anchorDate: Date,
        private readonly kind: "task" | "event",
        target: FocusTarget,
        private readonly onComplete: () => void,
        private readonly openKind: (kind: "inbox" | "event" | "task") => void,
    ) {
        super(app);
        const settings = getSettings();
        const state = new EventTaskFormState(anchorDate, {
            file: target.file,
            heading: target.heading,
            position: target.position,
            detailNotesFolder: settings.eventTask.detailNotesFolder,
        });
        state.kind = kind;
        this.data = scheduledItemFormDataFromCreateState(state);
        this.context = {
            targetFile: target.file,
            targetHeading: target.heading,
            targetPosition: target.position,
            targetManuallyEdited: false,
        };
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
            defaultDetailNotesFolder: new TargetResolver(this.getSettings()).getDetailNotesFolder(
                this.context.targetFile,
            ),
            getContextSources: () => this.getSettings().inbox.contextSources,
            getAllowedTaskSources: () => {
                const s = this.getSettings();
                return resolveAllowedTaskSources(s.inbox.contextSources, s.captureTask.allowedSourceIds);
            },
            onChange: () => undefined,
            onSubmit: () => void this.submit(),
            onCancel: () => this.close(),
            onSwitchKind: (kind) => this.switchKind(kind),
            onPlannedStartChange: (value) => this.autoSyncEventTargetFile(value),
        });
        this.renderer.render(this.contentEl);
    }

    private switchKind(kind: "inbox" | "event" | "task"): void {
        if (kind === this.kind) return;
        this.close();
        this.openKind(kind);
    }

    /** Keeps "Save to file" following Planned Start until the user edits it directly. */
    private autoSyncEventTargetFile(plannedStart: string): void {
        if (this.kind !== "event" || this.context.targetManuallyEdited) return;
        const start = parseLocalDateTime(plannedStart, true);
        if (!start) return;
        const settings = this.getSettings();
        const resolver = new TargetResolver(settings);
        const target = resolveEventCaptureTarget(
            resolver.getPeriodicalTarget(settings.captureEvent.profileId, start),
            settings.captureEvent,
        );
        this.context.targetFile = target.file;
        this.renderer?.render(this.contentEl);
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
        const writer = new EventTaskWriter(this.app, this.getSettings().eventTask, () => this.getSettings());
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
        if (!(await this.writeEventDayProjection(writer))) return;
        if (!(await this.writeTaskDayProjection(writer))) return;
        await this.writeRelated(writer);
    }

    private async writePrimary(writer: EventTaskWriter, attachment: HubNoteRef | null): Promise<void> {
        const built = buildScheduledItemRecord(this.data);
        if (built.status === "invalid") throw new Error(built.message);
        const targetPath = this.resolvePrimaryTarget();
        if (!targetPath) throw new Error("Scheduled Item fields are invalid.");
        this.primaryBlockId = await writer.write(
            built.record,
            targetPath,
            this.context.targetHeading.trim(),
            this.context.targetPosition,
            attachment,
        );
        this.primaryPath = targetPath;
    }

    /** Writes multi-day Event references for every touched day beyond the canonical start day. */
    private async writeEventDayProjection(writer: EventTaskWriter): Promise<boolean> {
        if (this.data.kind !== "event" || !this.primaryPath || !this.primaryBlockId) return true;
        const start = parseLocalDateTime(this.data.start, this.data.allDay);
        if (!start) return true;
        const end = !this.data.allDay && this.data.end ? parseLocalDateTime(this.data.end, false) : null;
        const settings = this.getSettings();
        const result = await runEventDayProjection(
            this.app,
            settings,
            {
                title: this.data.title,
                start,
                end,
                allDay: this.data.allDay,
                canonicalFilePath: this.primaryPath,
                canonicalBlockId: this.primaryBlockId,
                heading: settings.captureEvent.heading,
                position: settings.captureEvent.position,
            },
            [],
            writer,
        );
        if (result.status === "partial") {
            this.pendingDayProjection = result;
            this.showResult(result.message, false);
            return false;
        }
        return true;
    }

    private async retryDayProjection(): Promise<void> {
        const pending = this.pendingDayProjection;
        if (!pending) return;
        const writer = new EventTaskWriter(this.app, this.getSettings().eventTask, () => this.getSettings());
        const result = await retryEventDayProjectionRuntime(this.app, this.getSettings(), pending, writer);
        if (result.status === "partial") {
            this.pendingDayProjection = result;
            this.showResult(result.message, false);
            return;
        }
        this.pendingDayProjection = null;
        if (!(await this.writeTaskDayProjection(writer))) return;
        await this.writeRelated(writer);
    }

    /** Writes a due-date reference for a brand-new Task; new Tasks start with no timeboxes yet. */
    private async writeTaskDayProjection(writer: EventTaskWriter): Promise<boolean> {
        if (this.data.kind !== "task" || !this.primaryPath || !this.primaryBlockId) return true;
        const dueDayKey = this.data.due ? this.data.due.slice(0, 10) : null;
        if (!dueDayKey) return true;
        const settings = this.getSettings();
        const result = await runTaskDayProjection(
            this.app,
            settings,
            {
                title: this.data.title,
                completed: false,
                dueDayKey,
                timeboxes: [],
                canonicalFilePath: this.primaryPath,
                canonicalBlockId: this.primaryBlockId,
                heading: settings.captureTask.heading,
                position: settings.captureTask.position,
            },
            [],
            writer,
        );
        if (result.status === "partial") {
            this.pendingTaskDayProjection = result;
            this.showResult(result.message, false);
            return false;
        }
        return true;
    }

    private async retryTaskDayProjection(): Promise<void> {
        const pending = this.pendingTaskDayProjection;
        if (!pending) return;
        const writer = new EventTaskWriter(this.app, this.getSettings().eventTask, () => this.getSettings());
        const result = await retryTaskDayProjectionRuntime(this.app, this.getSettings(), pending, writer);
        if (result.status === "partial") {
            this.pendingTaskDayProjection = result;
            this.showResult(result.message, false);
            return;
        }
        this.pendingTaskDayProjection = null;
        await this.writeRelated(writer);
    }

    private resolvePrimaryTarget(): string | null {
        const built = buildScheduledItemRecord(this.data);
        if (built.status === "invalid") return null;
        const when =
            built.record.kind === "event"
                ? built.record.start
                : (built.record.due ?? built.record.timebox?.start ?? new Date());
        return new TargetResolver(this.getSettings()).resolve(
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
        const writer = new EventTaskWriter(this.app, this.getSettings().eventTask, () => this.getSettings());
        const result = await retryDetailNoteAttachment(pending, (attachment) => this.writePrimary(writer, attachment));
        if (result.status === "partial") {
            this.pendingDetail = result;
            this.showResult(result.message, false);
            return;
        }
        this.pendingDetail = null;
        if (!(await this.writeEventDayProjection(writer))) return;
        if (!(await this.writeTaskDayProjection(writer))) return;
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
            formatSourceLink: createObsidianLinkFormatter(this.app),
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
        const writer = new EventTaskWriter(this.app, this.getSettings().eventTask, () => this.getSettings());
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

    private setBusy(busy: boolean): void {
        this.busy = busy;
        this.renderer?.setSubmissionState({ busy, recovery: this.hasPendingRecovery() });
    }

    private hasPendingRecovery(): boolean {
        return (
            this.pendingDetail !== null ||
            this.pendingDayProjection !== null ||
            this.pendingTaskDayProjection !== null ||
            this.pendingRelated !== null
        );
    }
}
