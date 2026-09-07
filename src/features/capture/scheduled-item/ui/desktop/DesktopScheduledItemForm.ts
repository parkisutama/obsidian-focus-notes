import { type App, Setting } from "obsidian";
import { buildDesktopScheduledItemFormModel } from "./DesktopScheduledItemFormModel.ts";
import { ContextNotesController } from "../../../moment/ui/InboxNotesController";
import { parseObjectReferences } from "../../../domain/ObjectReference.ts";
import type { ScheduledItemFormData } from "../../domain/ScheduledItemFormData";
import type { ContextSourceSettings } from "../../../../object-notes/domain/ContextSourceSettings";
import type { ScannedFocusSession } from "../../../../focus-session/domain/FocusSessionBlockScan.ts";
import {
    type DesktopScheduledItemCreateContext,
    renderDesktopCreateTargetSection,
} from "./DesktopCreateTargetSection.ts";
import { renderDesktopDetailSection } from "./DesktopDetailSection.ts";
import { renderDesktopFocusSessionsSection } from "./DesktopFocusSessionsSection.ts";
import { renderDesktopFocusSummarySection } from "./DesktopFocusSummarySection.ts";
import type { FormattedFocusSummary } from "../../domain/ScheduledItemFocusSummary.ts";
import { renderDesktopReflectionSection } from "./DesktopTaskReflectionSection.ts";
import { renderDesktopTemporalSection } from "./DesktopTemporalSection.ts";
import type { DateTimeInput } from "../../../../../infrastructure/obsidian/datetime/DateTimeInput.ts";
import { renderFocusDisclosure } from "../FocusDisclosure.ts";

export type { DesktopScheduledItemCreateContext } from "./DesktopCreateTargetSection.ts";

export interface DesktopScheduledItemFormOptions {
    app: App;
    mode: "create" | "edit";
    data: ScheduledItemFormData;
    contextLabel: string;
    targetFile: string;
    createContext?: DesktopScheduledItemCreateContext;
    defaultDetailNotesFolder?: string;
    getContextSources(): ContextSourceSettings[];
    /** Object Sources allowed as Task "Save to" destinations. Only consulted when data.kind === "task". */
    getAllowedTaskSources?(): ContextSourceSettings[];
    onChange(data: ScheduledItemFormData): void;
    onSubmit(): void;
    onCancel(): void;
    /** Switch the capture kind without requiring the user to close and reopen the form. Create mode only. */
    onSwitchKind?(kind: "inbox" | "event" | "task"): void;
    onPlannedStartChange?(value: string): void;
    /** Edit-mode Task only: opens the Timebox Manager for this Task's saved canonical block. */
    onManageTimeboxes?(): void;
    /** Edit mode only: Focus Sessions already logged against this Event/Task's canonical block. */
    focusSessions?: ScannedFocusSession[];
    onEditFocusSession?(session: ScannedFocusSession): void;
    focusSummary?: FormattedFocusSummary | null; // Task 61/63's shared summary, pre-computed by the caller
}

export class DesktopScheduledItemForm {
    private container: HTMLElement | null = null;
    private descriptionController: ContextNotesController | null = null;
    private reflectionNotesController: ContextNotesController | null = null;
    private dateTimePickers: DateTimeInput[] = [];
    private busy = false;
    private recovery = false;
    private errorMessage = "";

    constructor(private readonly options: DesktopScheduledItemFormOptions) {}

    render(container: HTMLElement): void {
        this.destroyController();
        // contentEl doesn't scroll itself — the ancestor `.modal` element does — so the
        // scroll position has to be read from and restored onto that ancestor instead.
        const scrollHost = container.closest<HTMLElement>(".modal") ?? container;
        const scrollTop = scrollHost.scrollTop;
        this.container = container;
        container.empty();
        container.addClass("fn-scheduled-item-desktop-form");
        const model = buildDesktopScheduledItemFormModel({
            mode: this.options.mode,
            data: this.options.data,
            contextLabel: this.options.contextLabel,
            busy: this.busy,
            recovery: this.recovery,
        });

        const header = container.createDiv({ cls: "fn-scheduled-item-form-header" });
        header.createEl("h2", { text: model.heading });
        header.createDiv({ cls: "fn-scheduled-item-form-context", text: model.contextLabel });
        this.renderKindChips(container);
        this.renderIdentity(container);
        this.dateTimePickers = renderDesktopTemporalSection(container, {
            mode: this.options.mode,
            data: this.options.data,
            update: (change) => this.update(change),
            changedAndRender: () => this.changedAndRender(),
            onEventStartChanged: (value) => this.options.onPlannedStartChange?.(value),
            onManageTimeboxes: this.options.onManageTimeboxes,
            renderAfterDue: this.options.data.kind === "task" ? () => this.renderDescription(container) : undefined,
        });
        if (this.options.data.kind !== "task") this.renderDescription(container);
        renderFocusDisclosure(container, {
            summary: this.options.focusSummary,
            sessions: this.options.focusSessions,
            renderBody: (body) => {
                if (this.options.focusSummary) renderDesktopFocusSummarySection(body, this.options.focusSummary);
                if (this.options.focusSessions && this.options.onEditFocusSession)
                    renderDesktopFocusSessionsSection(body, {
                        sessions: this.options.focusSessions,
                        onEdit: this.options.onEditFocusSession,
                    });
            },
        });
        if (this.options.mode === "edit" || this.options.mode === "create") {
            this.reflectionNotesController = renderDesktopReflectionSection(container, {
                app: this.options.app,
                data: this.options.data,
                targetFile: this.options.targetFile,
                getContextSources: this.options.getContextSources,
                update: (change) => this.update(change),
            });
        }
        renderDesktopDetailSection(container, {
            app: this.options.app,
            data: this.options.data,
            defaultDetailNotesFolder: this.options.defaultDetailNotesFolder,
            update: (change) => this.update(change),
            changedAndRender: () => this.changedAndRender(),
        });
        if (this.options.mode === "create" && this.options.createContext) {
            renderDesktopCreateTargetSection(container, {
                app: this.options.app,
                data: this.options.data,
                context: this.options.createContext,
                getAllowedTaskSources: () => this.options.getAllowedTaskSources?.() ?? [],
                onTargetFileChange: (value) => this.descriptionController?.setTargetFile(value),
            });
        }
        container.createDiv({
            cls: `fn-scheduled-item-form-error${this.errorMessage ? "" : " fn-gcal-hidden"}`,
            text: this.errorMessage,
            attr: { role: "alert", "aria-live": "polite" },
        });

        const actions = container.createDiv({ cls: "fn-timeline-modal-actions" });
        actions
            .createEl("button", { text: "Cancel", attr: { type: "button" } })
            .addEventListener("click", this.options.onCancel);
        const submit = actions.createEl("button", {
            cls: "mod-cta",
            text: model.submitLabel,
            attr: { type: "button", "aria-busy": model.ariaBusy },
        });
        submit.disabled = model.submitDisabled;
        submit.addEventListener("click", this.options.onSubmit);
        if (this.busy || this.recovery) this.lockFields(container, actions);
        scrollHost.scrollTop = scrollTop;
    }

    setSubmissionState(state: { busy: boolean; recovery: boolean; errorMessage?: string }): void {
        this.busy = state.busy;
        this.recovery = state.recovery;
        this.errorMessage = state.errorMessage ?? "";
        if (this.container) this.render(this.container);
    }

    destroy(): void {
        this.destroyController();
        this.container = null;
    }

    private renderKindChips(container: HTMLElement): void {
        const onSwitchKind = this.options.onSwitchKind;
        if (this.options.mode !== "create" || !onSwitchKind) return;
        const currentKind = this.options.data.kind;
        const tabs = container.createDiv({ cls: "fn-gcal-tabs" });
        const chips: Array<{ value: "inbox" | "event" | "task"; label: string }> = [
            { value: "inbox", label: "Moment" },
            { value: "event", label: "Event" },
            { value: "task", label: "Task" },
        ];
        for (const chip of chips) {
            const active = chip.value === currentKind;
            const button = tabs.createEl("button", {
                cls: `fn-gcal-tab${active ? " fn-gcal-tab--active" : ""}`,
                text: chip.label,
                attr: { type: "button", "aria-pressed": String(active) },
            });
            button.addEventListener("click", () => onSwitchKind(chip.value));
        }
    }

    private renderIdentity(container: HTMLElement): void {
        const title = new Setting(container).setName("Title").setClass("fn-scheduled-item-form-wide-field");
        title.addText((text) =>
            text
                .setPlaceholder("Add title")
                .setValue(this.options.data.title)
                .onChange((value) => this.update(() => (this.options.data.title = value))),
        );
    }

    private renderDescription(container: HTMLElement): void {
        const setting = new Setting(container)
            .setName("Description")
            .setDesc("Use @ for Object Notes, Tasks, or Events; @task and @event search stable block links.")
            .setClass("fn-scheduled-item-form-wide-field");
        const editor = setting.controlEl.createDiv({
            cls: "fn-gcal-desc-input",
            attr: { role: "textbox", "aria-label": "Description", "aria-multiline": "true" },
        });
        this.descriptionController = new ContextNotesController(this.options.app, editor, {
            initialValue: this.options.data.description,
            targetFile: this.options.targetFile,
            getContextSources: this.options.getContextSources,
            referenceFormat: "markdown-link",
            onChange: (value) => {
                this.options.data.description = value;
                this.options.data.objectReferences = parseObjectReferences(value).map(
                    (occurrence) => occurrence.reference,
                );
                this.options.onChange(this.options.data);
            },
        });
    }

    private update(change: () => void): void {
        change();
        this.options.onChange(this.options.data);
    }

    private changedAndRender(): void {
        this.options.onChange(this.options.data);
        if (this.container) this.render(this.container);
    }

    private destroyController(): void {
        this.descriptionController?.destroy();
        this.descriptionController = null;
        this.reflectionNotesController?.destroy();
        this.reflectionNotesController = null;
        for (const picker of this.dateTimePickers) picker.destroy();
        this.dateTimePickers = [];
    }

    private lockFields(container: HTMLElement, actions: HTMLElement): void {
        container
            .querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>("input, select, button")
            .forEach((control) => {
                if (!actions.contains(control)) control.disabled = true;
            });
        container.querySelectorAll<HTMLElement>("[contenteditable]").forEach((editor) => {
            editor.contentEditable = "false";
            editor.setAttribute("aria-disabled", "true");
        });
    }
}
