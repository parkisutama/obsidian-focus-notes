import { type App, Modal, Notice } from "obsidian";
import { preferActiveNoteTarget } from "../../../domain/ActiveCaptureTarget";
import { EventTaskFormState } from "../../../domain/EventTaskFormState";
import type { EventTaskKind, OpenEventTaskFormOptions } from "../../../domain/CaptureForm";
import {
    type EventTaskSubmissionResult,
    type PartialSubmissionResult,
    retryRelatedSubmission,
    submitInbox,
} from "../../application/EventTaskSubmission";
import { EventTaskWriter } from "../../../../../infrastructure/obsidian/capture/EventTaskWriter";
import { InboxDesktopForm } from "./InboxDesktopForm";
import { resolveInboxFormTarget, selectInboxTarget } from "../../domain/InboxTarget";
import { readContextSuggestionNotes } from "../../../../../infrastructure/obsidian/suggestions/ObsidianInboxSuggestionSource";
import {
    createObsidianLinkFormatter,
    createObsidianLinkResolver,
} from "../../../../../infrastructure/obsidian/suggestions/ObsidianLinkResolver.ts";
import { SubmissionPolicy } from "../../application/SubmissionPolicy";
import { TargetResolver } from "../../../../../infrastructure/obsidian/capture/TargetResolver";
import type { FocusNotesSettings } from "../../../../settings/domain/FocusNotesSettings";
import type { FocusTarget } from "../../../domain/CaptureTarget";

/**
 * Moment (Inbox) capture shell. Event and Task both redirect to
 * ScheduledItemDesktopCreateModal before any of their fields are ever
 * rendered or read — see the Event/Task tab buttons in renderTabs() — so
 * this class only ever renders and submits the Inbox kind. The redirect
 * itself is injected via openScheduledItem (see EventTaskCaptureLauncher.ts)
 * so this file has no reason to import the launcher back.
 */
export class EventTaskModal extends Modal {
    protected form: EventTaskFormState;

    protected resolved = false;
    private readonly submissionPolicy = new SubmissionPolicy();

    // ---- DOM refs -----------------------------------------------------------
    private saveButtonEl!: HTMLButtonElement;
    private titleInputEl!: HTMLInputElement;
    private inboxSectionEl!: HTMLElement;
    private inboxForm: InboxDesktopForm | null = null;
    private pendingRecovery: PartialSubmissionResult | null = null;
    private recoveryInFlight = false;
    private completionNotified = false;
    constructor(
        app: App,
        private getSettings: () => FocusNotesSettings,
        anchorDate: Date = new Date(),
        private onComplete: () => void = () => {},
        options: OpenEventTaskFormOptions = {},
        private readonly openScheduledItem: (kind: "task" | "event") => void = () => {},
    ) {
        super(app);

        const settings = getSettings();
        const resolver = new TargetResolver(app, settings);
        const configured: FocusTarget = resolver.getPeriodicalTarget(settings.captureEvent.profileId, anchorDate) ?? {
            file: "",
            heading: settings.captureEvent.heading,
            position: settings.captureEvent.position,
        };
        const activeFile = app.workspace.getActiveFile();
        const resolved = preferActiveNoteTarget(
            configured,
            options.targetFile ?? (activeFile?.extension === "md" ? activeFile.path : null),
        );
        const inboxTarget = selectInboxTarget({
            useEventCaptureTarget: settings.captureMoment.useEventCaptureTarget,
            eventTaskTarget: resolved,
            periodicalTarget: resolver.getPeriodicalTarget(settings.captureMoment.profileId, anchorDate),
            heading: settings.captureMoment.heading,
            position: settings.captureMoment.position,
        });
        this.form = new EventTaskFormState(anchorDate, {
            file: resolved.file,
            heading: settings.captureEvent.heading || resolved.heading,
            position: resolved.position,
            detailNotesFolder: settings.eventTask.detailNotesFolder,
            inboxTargetFile: inboxTarget?.file ?? "",
            inboxHeading: inboxTarget?.heading ?? settings.captureMoment.heading,
            inboxPosition: inboxTarget?.position ?? settings.captureMoment.position,
        });
        this.form.kind = options.initialKind ?? "inbox";
    }

    onOpen(): void {
        this.modalEl.addClass("fn-gcal-modal");
        document.body.addClass("fn-event-task-modal-open");
        const { contentEl } = this;
        contentEl.empty();
        this.renderForm(contentEl);
    }

    onClose(): void {
        document.body.removeClass("fn-event-task-modal-open");
        this.inboxForm?.destroy();
        this.inboxForm = null;
        this.contentEl.empty();
        if (!this.resolved) this.resolved = true;
    }

    protected renderForm(contentEl: HTMLElement): void {
        contentEl.addClass("fn-gcal-content");

        this.renderTitle(contentEl);
        this.renderTabs(contentEl);

        const body = contentEl.createDiv({ cls: "fn-gcal-body" });
        this.inboxSectionEl = body.createDiv({ cls: "fn-gcal-tab-section" });
        this.inboxSectionEl.toggleClass("fn-gcal-hidden", this.form.kind !== "inbox");
        this.inboxForm = new InboxDesktopForm({
            app: this.app,
            form: this.form,
            getSettings: this.getSettings,
            resolveTarget: () => this.resolveInboxTarget(),
        });
        this.inboxForm.render(this.inboxSectionEl);
        this.renderButtons(contentEl);
    }

    // =========================================================================
    // Render helpers
    // =========================================================================

    protected renderTitle(container: HTMLElement): void {
        this.titleInputEl = container.createEl("input", {
            type: "text",
            cls: "fn-gcal-title-input",
            attr: { placeholder: "Add title", "aria-label": "Title" },
        });
        this.titleInputEl.value = this.form.getTitleForKind(this.form.kind);
        this.titleInputEl.addEventListener("input", () => {
            this.setTitleValue(this.titleInputEl.value);
        });
        this.titleInputEl.addEventListener("keydown", (evt) => {
            if (evt.key === "Enter" && !evt.shiftKey) {
                evt.preventDefault();
                void this.submit();
            }
        });
        window.setTimeout(() => this.titleInputEl.focus(), 50);
    }

    protected setTitleValue(value: string): void {
        this.form.setTitleForKind(this.form.kind, value);
    }

    protected renderTabs(container: HTMLElement): void {
        const tabs = container.createDiv({ cls: "fn-gcal-tabs" });
        const inboxBtn = tabs.createEl("button", {
            cls: `fn-gcal-tab${this.form.kind === "inbox" ? " fn-gcal-tab--active" : ""}`,
            text: "Moment",
            attr: { type: "button", "aria-pressed": String(this.form.kind === "inbox") },
        });
        const eventBtn = tabs.createEl("button", {
            cls: `fn-gcal-tab${this.form.kind === "event" ? " fn-gcal-tab--active" : ""}`,
            text: "Event",
            attr: { type: "button", "aria-pressed": String(this.form.kind === "event") },
        });
        const taskBtn = tabs.createEl("button", {
            cls: `fn-gcal-tab${this.form.kind === "task" ? " fn-gcal-tab--active" : ""}`,
            text: "Task",
            attr: { type: "button", "aria-pressed": String(this.form.kind === "task") },
        });

        const buttons = new Map<EventTaskKind, HTMLButtonElement>([
            ["inbox", inboxBtn],
            ["event", eventBtn],
            ["task", taskBtn],
        ]);
        const activate = (kind: EventTaskKind): void => {
            if (kind === "task" || kind === "event") {
                this.resolved = true;
                this.close();
                // Recompute fresh instead of forwarding this.form.targetFile: that
                // shared field only ever holds Event's Daily-Notes-derived default
                // (it's not kind-aware), which would otherwise leak into Task too.
                this.openScheduledItem(kind);
                return;
            }
            this.form.kind = kind;
            this.titleInputEl.value = this.form.getTitleForKind(kind);
            for (const [value, button] of buttons) {
                const active = value === kind;
                button.toggleClass("fn-gcal-tab--active", active);
                button.setAttribute("aria-pressed", String(active));
            }
            this.inboxSectionEl.removeClass("fn-gcal-hidden");
        };
        inboxBtn.addEventListener("click", () => activate("inbox"));
        eventBtn.addEventListener("click", () => activate("event"));
        taskBtn.addEventListener("click", () => activate("task"));
    }

    // ---- Inbox section -----------------------------------------------------

    /**
     * The written heading is the plain per-day text (e.g. "2026-08-30") wrapped as a link back to
     * that day's Daily Note whenever the resolved target uses a dated per-period heading — the
     * Weekly-note counterpart to Group by Date's `dateSubHeadingTemplate` link, but going through
     * Obsidian's own link formatter so it follows the user's configured New Link Format (Shortest
     * path / Relative / Absolute) instead of a hardcoded style. Only the value handed to the
     * writer/preview is wrapped; `this.form.inboxHeading` (what the editable Heading field shows)
     * is set once at construction and never touched here, so the field stays plain, editable text.
     */
    private resolveInboxTarget(): FocusTarget | null {
        const settings = this.getSettings();
        const target = resolveInboxFormTarget(new TargetResolver(this.app, settings), this.form);
        if (!target || !this.momentUsesDatedHeading()) return target;
        const writer = new EventTaskWriter(this.app, settings.eventTask, () => settings);
        const linkedHeading = writer.formatDailyLink(this.form.inboxCapturedAt, target.file, target.heading);
        return { ...target, heading: linkedHeading };
    }

    private resolveMomentBacklinkTarget(record: { capturedAt: Date }): FocusTarget | null {
        const settings = this.getSettings();
        const backlink = settings.captureMoment.backlink;
        if (!backlink.enabled) return null;
        const resolver = new TargetResolver(this.app, settings);
        // The "daily" Periodical Notes profile already syncs from the core
        // Daily Notes plugin when enabled and falls back to its own manual
        // fields otherwise (see TargetResolver.getPeriodicalTarget()).
        const target = resolver.getPeriodicalTarget(backlink.profileId, record.capturedAt);
        if (!target?.file.trim()) return null;
        return { ...target, heading: backlink.heading || "Moments", position: backlink.position };
    }

    /** True when the Moment date is already carried by a dated per-period heading, so bullets skip repeating it. */
    private momentUsesDatedHeading(): boolean {
        const settings = this.getSettings();
        if (settings.captureMoment.useEventCaptureTarget) return false;
        const profile = settings.periodicalNotes.profiles.find(
            (candidate) => candidate.id === settings.captureMoment.profileId,
        );
        return Boolean(profile?.headingFormat);
    }

    // ---- Buttons ------------------------------------------------------------

    protected renderButtons(container: HTMLElement): void {
        const footer = container.createDiv({ cls: "fn-gcal-footer" });
        const discard = footer.createEl("button", {
            cls: "fn-gcal-btn-discard",
            text: "Cancel",
            attr: { type: "button" },
        });
        discard.addEventListener("click", () => {
            if (this.resolved) return;
            this.resolved = true;
            this.close();
        });
        const save = footer.createEl("button", {
            cls: "fn-gcal-btn-save mod-cta",
            text: "Save",
            attr: { type: "button" },
        });
        this.saveButtonEl = save;
        save.addEventListener("click", () => void this.submit());
    }

    // =========================================================================
    // Save logic
    // =========================================================================

    protected async submit(): Promise<void> {
        if (this.resolved) return;
        if (this.pendingRecovery) {
            await this.retryRelatedLogs();
            return;
        }

        const settings = this.getSettings();
        const writer = new EventTaskWriter(this.app, settings.eventTask, () => this.getSettings());
        await this.executeSubmission(() =>
            submitInbox(this.form, {
                writer,
                resolveTarget: () => this.resolveInboxTarget(),
                contextNotes: readContextSuggestionNotes(this.app),
                contextSources: settings.inbox.contextSources,
                resolveLinkDestination: createObsidianLinkResolver(this.app),
                formatSourceLink: createObsidianLinkFormatter(this.app),
                resolveDailyBacklinkTarget: (record) => this.resolveMomentBacklinkTarget(record),
                usesDatedHeading: this.momentUsesDatedHeading(),
            }),
        );
    }

    private async executeSubmission(operation: () => Promise<EventTaskSubmissionResult>): Promise<void> {
        const attempt = this.submissionPolicy.run(operation);
        if (!attempt) return;

        this.setSubmissionBusy(true);
        try {
            this.finishSubmission(await attempt);
        } finally {
            this.setSubmissionBusy(false);
        }
    }

    private setSubmissionBusy(busy: boolean): void {
        this.saveButtonEl.disabled = busy;
        this.saveButtonEl.setAttribute("aria-busy", String(busy));
        this.saveButtonEl.setText(busy ? "Saving…" : this.pendingRecovery ? "Retry related logs" : "Save");
    }

    private finishSubmission(result: EventTaskSubmissionResult): void {
        new Notice(result.message);
        if (result.status === "failure") return;
        if (!this.completionNotified) {
            this.completionNotified = true;
            this.onComplete();
        }
        if (result.status === "partial") {
            this.pendingRecovery = result;
            return;
        }
        this.pendingRecovery = null;
        this.resolved = true;
        this.close();
    }

    private async retryRelatedLogs(): Promise<void> {
        const recovery = this.pendingRecovery;
        if (!recovery || this.recoveryInFlight) return;
        this.recoveryInFlight = true;
        this.setSubmissionBusy(true);
        try {
            this.finishSubmission(await retryRelatedSubmission(recovery, new EventTaskWriter(this.app)));
        } catch (error) {
            new Notice(`Failed to retry related logs: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            this.recoveryInFlight = false;
            this.setSubmissionBusy(false);
        }
    }
}
