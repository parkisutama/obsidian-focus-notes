import { type App, Component, Notice } from "obsidian";
import { resolveAllowedTaskSources } from "./ContextSourceSettings.ts";
import {
    type DetailNotePromotionResult,
    promoteScheduledItemDetail,
    retryDetailNoteAttachment,
} from "./DetailNotePromotion.ts";
import { EventTaskFormState } from "./EventTaskFormState.ts";
import { EventTaskMobileScreen } from "./EventTaskMobileScreen.ts";
import { EventTaskWriter, type HubNoteRef } from "./EventTaskWriter.ts";
import { type MobileScheduledItemCreateContext, MobileScheduledItemForm } from "./MobileScheduledItemForm.ts";
import { readContextSuggestionNotes } from "./ObsidianInboxSuggestionSource.ts";
import { createObsidianLinkResolver } from "./ObsidianLinkResolver.ts";
import {
    retryScheduledItemCreateRelated,
    type ScheduledItemCreateRelatedResult,
    writeScheduledItemCreateRelated,
} from "./ScheduledItemCreateRelated.ts";
import { buildScheduledItemRecord } from "./ScheduledItemFormAdapter.ts";
import { type ScheduledItemFormData, scheduledItemFormDataFromCreateState } from "./ScheduledItemFormData.ts";
import { openMobileScheduledItemCreate } from "./ScheduledItemMobileCreateLauncher.ts";
import { TargetResolver } from "./TargetResolver.ts";
import type { FocusNotesSettings, FocusTarget } from "./types.ts";
import { isTFile } from "./utils.ts";

type PartialDetail = Extract<DetailNotePromotionResult, { status: "partial" }>;
type PartialRelated = Extract<ScheduledItemCreateRelatedResult, { status: "partial" }>;

export class ScheduledItemMobileCreateScreen extends Component {
    private readonly data: ScheduledItemFormData;
    private readonly context: MobileScheduledItemCreateContext;
    private renderer: MobileScheduledItemForm | null = null;
    private pendingDetail: PartialDetail | null = null;
    private pendingRelated: PartialRelated | null = null;
    private primaryPath: string | null = null;
    private busy = false;
    private completionNotified = false;
    private opened = false;

    constructor(
        private readonly app: App,
        private readonly getSettings: () => FocusNotesSettings,
        private readonly anchorDate: Date,
        private readonly kind: "task" | "event",
        target: FocusTarget,
        private readonly onComplete: () => void,
    ) {
        super();
        const settings = getSettings();
        // Hub notes are retired from this create flow (scheduledItemFormDataFromCreateState
        // doesn't carry hub fields), but the per-kind folder is still threaded through in case
        // that feature returns, matching the split the settings tab already exposes.
        const state = new EventTaskFormState(anchorDate, {
            file: target.file,
            heading: target.heading,
            position: target.position,
            hubNotesFolder: kind === "event" ? settings.captureEvent.hubNotesFolder : settings.captureTask.hubNotesFolder,
            detailNotesFolder: settings.eventTask.detailNotesFolder,
        });
        state.kind = kind;
        this.data = scheduledItemFormDataFromCreateState(state);
        this.context = { targetFile: target.file, targetHeading: target.heading, targetPosition: target.position };
    }

    open(): void {
        if (this.opened) return;
        this.opened = true;
        this.load();
        this.renderer = new MobileScheduledItemForm({
            app: this.app,
            mode: "create",
            data: this.data,
            contextLabel: `${this.context.targetFile} · ${this.context.targetHeading || "No heading"}`,
            targetFile: this.context.targetFile,
            createContext: this.context,
            defaultDetailNotesFolder: this.getSettings().eventTask.detailNotesFolder,
            getContextSources: () => this.getSettings().inbox.contextSources,
            getAllowedTaskSources: () => {
                const s = this.getSettings();
                return resolveAllowedTaskSources(s.inbox.contextSources, s.captureTask.allowedSourceIds);
            },
            onChange: () => undefined,
            onSubmit: () => void this.submit(),
            onCancel: () => this.close(),
            onSwitchKind: (kind) => this.switchKind(kind),
        });
        this.renderer.open(this);
    }

    private switchKind(kind: "inbox" | "event" | "task"): void {
        if (kind === this.kind) return;
        this.close();
        if (kind === "inbox") {
            new EventTaskMobileScreen(this.app, this.getSettings, this.anchorDate, this.onComplete, {
                initialKind: "inbox",
            }).open();
            return;
        }
        openMobileScheduledItemCreate(this.app, this.getSettings, this.anchorDate, this.onComplete, kind);
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
            else if (!this.context.targetFile.trim()) this.showResult("Please select a target file.", false);
            else await this.promoteAndWrite();
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
            createDetailNote: (name, record, folder, path, hubPath) =>
                writer.createDetailNote(name, record, folder, path, hubPath),
            attachDetail: (attachment) => this.writePrimary(writer, attachment),
        });
        if (result.status === "partial") {
            this.pendingDetail = result;
            this.showResult(result.message, false);
        } else if (result.status === "failure") this.showResult(result.message, false);
        else await this.writeRelated(writer);
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
        if (!this.primaryPath) {
            this.showResult("Primary Scheduled Item was not written.", false);
            return;
        }
        const result = await writeScheduledItemCreateRelated(this.data, this.primaryPath, {
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
        } else this.showResult(result.message, true);
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
        if (complete) {
            this.notifyCompletion();
            this.close();
        } else
            this.renderer?.setSubmissionState({
                busy: false,
                recovery: this.pendingDetail !== null || this.pendingRelated !== null,
                errorMessage: message,
            });
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
