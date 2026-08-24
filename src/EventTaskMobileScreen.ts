import { type App, Component, Notice, setIcon } from "obsidian";
import { preferActiveNoteTarget } from "./CaptureTarget";
import { EventTaskFormState } from "./EventTaskFormState";
import type { EventTaskKind, OpenEventTaskFormOptions } from "./features/capture/domain/CaptureForm";
import {
    type EventTaskSubmissionResult,
    type PartialSubmissionResult,
    retryRelatedSubmission,
    submitInbox,
} from "./features/capture/moment/application/EventTaskSubmission";
import { EventTaskWriter } from "./infrastructure/obsidian/EventTaskWriter";
import { InboxMobileForm } from "./InboxMobileForm";
import { resolveInboxFormTarget, selectInboxTarget } from "./InboxTarget";
import { getMobileViewportMetrics } from "./MobileViewport";
import { readContextSuggestionNotes } from "./infrastructure/obsidian/ObsidianInboxSuggestionSource";
import {
    createObsidianLinkFormatter,
    createObsidianLinkResolver,
} from "./infrastructure/obsidian/ObsidianLinkResolver.ts";
import { SubmissionPolicy } from "./SubmissionPolicy";
import { TargetResolver } from "./TargetResolver";
import type { FocusNotesSettings } from "./features/settings/domain/FocusNotesSettings";
import type { FocusTarget } from "./features/capture/domain/CaptureTarget";

/**
 * Moment (Inbox) capture shell. Event and Task both redirect to
 * ScheduledItemMobileCreateScreen before any of their fields are ever
 * rendered or read — see the Event/Task buttons in renderKindSelector() —
 * so this class only ever renders and submits the Inbox kind.
 */
export class EventTaskMobileScreen extends Component {
    private rootEl: HTMLElement | null = null;
    private bodyEl: HTMLElement | null = null;
    private saveButtonEl: HTMLButtonElement | null = null;
    private resolved = false;
    private readonly submissionPolicy = new SubmissionPolicy();
    private owner: Component | null = null;
    private readonly form: EventTaskFormState;
    private pendingRecovery: PartialSubmissionResult | null = null;
    private recoveryInFlight = false;
    private completionNotified = false;

    constructor(
        private readonly app: App,
        private readonly getSettings: () => FocusNotesSettings,
        anchorDate: Date = new Date(),
        private readonly onComplete: () => void = () => {},
        options: OpenEventTaskFormOptions = {},
        private readonly openScheduledItem: (kind: "task" | "event") => void,
    ) {
        super();
        const settings = getSettings();
        const resolver = new TargetResolver(app, settings);
        const configured: FocusTarget = resolver.getPeriodicalTarget(settings.captureEvent.profileId, anchorDate) ?? {
            file: "",
            heading: settings.captureEvent.heading,
            position: settings.captureEvent.position,
        };
        const activeFile = app.workspace.getActiveFile();
        const target = preferActiveNoteTarget(
            configured,
            options.targetFile ?? (activeFile?.extension === "md" ? activeFile.path : null),
        );
        const inboxTarget = selectInboxTarget({
            useEventCaptureTarget: settings.captureMoment.useEventCaptureTarget,
            eventTaskTarget: target,
            periodicalTarget: resolver.getPeriodicalTarget(settings.captureMoment.profileId, anchorDate),
            heading: settings.captureMoment.heading,
            position: settings.captureMoment.position,
        });
        this.form = new EventTaskFormState(anchorDate, {
            file: target.file,
            heading: settings.captureEvent.heading || target.heading,
            position: target.position,
            hubNotesFolder: settings.captureEvent.hubNotesFolder,
            detailNotesFolder: settings.eventTask.detailNotesFolder,
            inboxTargetFile: inboxTarget?.file ?? "",
            inboxHeading: inboxTarget?.heading ?? settings.captureMoment.heading,
            inboxPosition: inboxTarget?.position ?? settings.captureMoment.position,
        });
        this.form.kind = options.initialKind ?? "inbox";
    }

    open(owner?: Component): void {
        if (this.rootEl || document.querySelector(".fn-mobile-event-screen")) return;

        this.rootEl = this.app.workspace.containerEl.createDiv({
            cls: "fn-mobile-event-screen",
            attr: { role: "dialog", "aria-modal": "true", "aria-label": "Create moment, event, or task" },
        });
        document.body.addClass("fn-mobile-event-screen-open");
        this.render();
        this.registerLifecycle();
        if (owner) {
            this.owner = owner;
            owner.addChild(this);
        } else {
            this.load();
        }
    }

    close(): void {
        if (!this.rootEl) return;
        this.resolved = true;
        if (this.owner) {
            const owner = this.owner;
            this.owner = null;
            owner.removeChild(this);
        } else {
            this.unload();
        }
    }

    onunload(): void {
        this.rootEl?.remove();
        this.rootEl = null;
        this.bodyEl = null;
        this.owner = null;
        document.body.removeClass("fn-mobile-event-screen-open");
    }

    private render(): void {
        const root = this.rootEl;
        if (!root) return;
        root.createDiv({ cls: "fn-mobile-event-handle", attr: { "aria-hidden": "true" } });
        const header = root.createEl("header", { cls: "fn-mobile-event-header" });
        const cancel = header.createEl("button", {
            cls: "fn-mobile-event-cancel",
            attr: { type: "button", "aria-label": "Cancel" },
        });
        setIcon(cancel, "x");
        const save = header.createEl("button", {
            cls: "fn-mobile-event-save mod-cta",
            text: "Save",
            attr: { type: "button" },
        });
        this.saveButtonEl = save;

        this.bodyEl = root.createEl("main", { cls: "fn-mobile-event-body" });
        const title = this.bodyEl.createEl("input", {
            type: "text",
            cls: "fn-mobile-event-title",
            attr: { placeholder: "Add title", "aria-label": "Title" },
        });
        title.value = this.form.getTitleForKind(this.form.kind);
        this.registerDomEvent(title, "input", () => this.setTitle(title.value));
        this.registerDomEvent(title, "keydown", (event) => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void this.submit();
            }
        });

        const inboxSection = this.bodyEl.createDiv({ cls: "fn-mobile-inbox-primary" });
        this.renderKindSelector(
            this.bodyEl,
            (kind) => {
                title.value = this.form.getTitleForKind(kind);
                inboxSection.toggleClass("fn-gcal-hidden", kind !== "inbox");
            },
            inboxSection,
        );

        new InboxMobileForm({
            app: this.app,
            form: this.form,
            getSettings: this.getSettings,
            resolveTarget: () => this.resolveInboxTarget(),
            registerCleanup: (cleanup) => this.register(cleanup),
        }).render(inboxSection);

        this.registerDomEvent(cancel, "click", () => this.close());
        this.registerDomEvent(save, "click", () => void this.submit());
        const focusTimer = window.setTimeout(() => title.focus(), 50);
        this.register(() => window.clearTimeout(focusTimer));
    }

    private renderKindSelector(
        container: HTMLElement,
        onChange: (kind: EventTaskKind) => void,
        before: HTMLElement,
    ): void {
        const group = container.createDiv({
            cls: "fn-mobile-event-kind",
            attr: { role: "group", "aria-label": "Item type" },
        });
        container.insertBefore(group, before);
        const inboxButton = group.createEl("button", {
            cls: "fn-mobile-event-kind-button is-active",
            text: "Moment",
            attr: { type: "button", "aria-pressed": "true" },
        });
        const eventButton = group.createEl("button", {
            cls: "fn-mobile-event-kind-button",
            text: "Event",
            attr: { type: "button", "aria-pressed": "false" },
        });
        const taskButton = group.createEl("button", {
            cls: "fn-mobile-event-kind-button",
            text: "Task",
            attr: { type: "button", "aria-pressed": "false" },
        });
        const activate = (kind: EventTaskKind): void => {
            this.form.kind = kind;
            const isInbox = kind === "inbox";
            const isEvent = kind === "event";
            inboxButton.toggleClass("is-active", isInbox);
            eventButton.toggleClass("is-active", isEvent);
            taskButton.toggleClass("is-active", !isInbox && !isEvent);
            inboxButton.setAttribute("aria-pressed", String(isInbox));
            eventButton.setAttribute("aria-pressed", String(isEvent));
            taskButton.setAttribute("aria-pressed", String(!isInbox && !isEvent));
            onChange(kind);
        };
        this.registerDomEvent(inboxButton, "click", () => activate("inbox"));
        this.registerDomEvent(eventButton, "click", () => this.openScheduledItemCreate("event"));
        this.registerDomEvent(taskButton, "click", () => this.openScheduledItemCreate("task"));
        activate(this.form.kind);
    }

    private openScheduledItemCreate(kind: "task" | "event"): void {
        this.close();
        // Recompute fresh instead of forwarding this.form.targetFile: that shared
        // field only ever holds Event's Daily-Notes-derived default (it's not
        // kind-aware), which would otherwise leak into Task too.
        this.openScheduledItem(kind);
    }

    private setTitle(value: string): void {
        if (this.form.kind === "inbox") {
            this.form.inboxTitle = value;
            return;
        }
        this.form.title = value;
    }

    private registerLifecycle(): void {
        const root = this.rootEl;
        if (!root) return;
        const viewport = window.visualViewport;
        const updateViewport = (): void => {
            const workspaceTop = this.app.workspace.containerEl.getBoundingClientRect().top;
            const metrics = getMobileViewportMetrics(window.innerHeight, viewport ?? undefined, workspaceTop, 8);
            root.style.setProperty("--fn-mobile-screen-height", `${metrics.height}px`);
            root.style.setProperty("--fn-mobile-screen-top", `${metrics.offsetTop}px`);
        };
        const revealFocusedField = (): void => {
            const active = document.activeElement;
            if (!(active instanceof HTMLElement) || !root.contains(active)) return;
            window.setTimeout(() => active.scrollIntoView({ block: "nearest", inline: "nearest" }), 50);
        };
        updateViewport();
        this.registerDomEvent(window, "resize", updateViewport);
        this.registerDomEvent(window, "keydown", (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                this.close();
            }
        });
        this.registerDomEvent(root, "focusin", revealFocusedField);
        if (viewport) {
            viewport.addEventListener("resize", updateViewport);
            viewport.addEventListener("scroll", updateViewport);
            viewport.addEventListener("resize", revealFocusedField);
            this.register(() => {
                viewport.removeEventListener("resize", updateViewport);
                viewport.removeEventListener("scroll", updateViewport);
                viewport.removeEventListener("resize", revealFocusedField);
            });
        }
    }

    private async submit(): Promise<void> {
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
        if (!this.saveButtonEl) return;
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

    private resolveInboxTarget(): FocusTarget | null {
        return resolveInboxFormTarget(new TargetResolver(this.app, this.getSettings()), this.form);
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
}
