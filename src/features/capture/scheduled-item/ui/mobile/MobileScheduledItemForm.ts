import { type App, Component, Setting, setIcon } from "obsidian";
import { ContextNotesController } from "../../../moment/ui/InboxNotesController.ts";
import { buildMobileScheduledItemFormModel } from "./MobileScheduledItemFormModel.ts";
import { getMobileViewportMetrics } from "./MobileViewport.ts";
import { parseObjectReferences } from "../../../domain/ObjectReference.ts";
import type { ScheduledItemFormData } from "../../domain/ScheduledItemFormData.ts";
import type { ContextSourceSettings } from "../../../../object-notes/domain/ContextSourceSettings";
import { MobileFormFields } from "./MobileFormFields.ts";
import {
    type MobileScheduledItemCreateContext,
    renderMobileDetailSection,
    renderMobileTargetSection,
} from "./MobileSupplementalSections.ts";
import { renderMobileTemporalSection } from "./MobileTemporalSection.ts";
import { renderMobileReflectionSection } from "./MobileReflectionSection.ts";
import type { ScannedFocusSession } from "../../../../focus-session/domain/FocusSessionBlockScan.ts";
import { renderMobileFocusSessionsSection } from "./MobileFocusSessionsSection.ts";
import { renderMobileFocusSummarySection } from "./MobileFocusSummarySection.ts";
import type { FormattedFocusSummary } from "../../domain/ScheduledItemFocusSummary.ts";

export type { MobileScheduledItemCreateContext } from "./MobileSupplementalSections.ts";

export interface MobileScheduledItemFormOptions {
    app: App;
    mode: "create" | "edit";
    data: ScheduledItemFormData;
    contextLabel: string;
    targetFile: string;
    createContext?: MobileScheduledItemCreateContext;
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
    onManageTimeboxes?(): void;
    focusSessions?: ScannedFocusSession[];
    onEditFocusSession?(session: ScannedFocusSession): void;
    focusSummary?: FormattedFocusSummary | null; // Task 61/63's shared summary, pre-computed by the caller
}

export class MobileScheduledItemForm extends Component {
    private rootEl: HTMLElement | null = null;
    private controller: ContextNotesController | null = null;
    private reflectionController: ContextNotesController | null = null;
    private fields: MobileFormFields | null = null;
    private busy = false;
    private recovery = false;
    private errorMessage = "";

    constructor(private readonly options: MobileScheduledItemFormOptions) { super(); }

    open(owner?: Component): void {
        if (this.rootEl) return;
        this.rootEl = this.options.app.workspace.containerEl.createDiv({
            cls: "fn-mobile-event-screen fn-mobile-scheduled-item-form",
            attr: { role: "dialog", "aria-modal": "true" },
        });
        document.body.addClass("fn-mobile-event-screen-open");
        this.render();
        this.registerViewportLifecycle();
        if (owner) owner.addChild(this);
        else this.load();
    }

    close(): void {
        this.options.onCancel();
    }

    onunload(): void {
        this.destroyFieldControllers();
        this.rootEl?.remove();
        this.rootEl = null;
        document.body.removeClass("fn-mobile-event-screen-open");
    }

    private destroyFieldControllers(): void {
        this.controller?.destroy();
        this.controller = null;
        this.reflectionController?.destroy();
        this.reflectionController = null;
        this.fields?.destroyPickers();
        this.fields = null;
    }

    setSubmissionState(state: { busy: boolean; recovery: boolean; errorMessage?: string }): void {
        this.busy = state.busy;
        this.recovery = state.recovery;
        this.errorMessage = state.errorMessage ?? "";
        this.render();
    }

    private render(): void {
        const root = this.rootEl;
        if (!root) return;
        this.destroyFieldControllers();
        root.empty();
        const model = buildMobileScheduledItemFormModel({
            mode: this.options.mode,
            data: this.options.data,
            contextLabel: this.options.contextLabel,
            busy: this.busy,
            recovery: this.recovery,
        });
        root.setAttribute("aria-label", model.heading);
        root.createDiv({ cls: "fn-mobile-event-handle", attr: { "aria-hidden": "true" } });
        const header = root.createEl("header", { cls: "fn-mobile-event-header" });
        const cancel = header.createEl("button", {
            cls: "fn-mobile-event-cancel",
            attr: { type: "button", "aria-label": "Cancel" },
        });
        setIcon(cancel, "x");
        cancel.addEventListener("click", this.options.onCancel);
        header.createDiv({ cls: "fn-mobile-scheduled-title", text: model.heading });
        const submit = header.createEl("button", {
            cls: "fn-mobile-event-save mod-cta",
            text: model.submitLabel,
            attr: { type: "button", "aria-busy": model.ariaBusy },
        });
        submit.disabled = model.submitDisabled;
        submit.addEventListener("click", this.options.onSubmit);

        const body = root.createEl("main", { cls: "fn-mobile-event-body" });
        const fields = (this.fields = new MobileFormFields((change) => this.changed(change)));
        body.createDiv({ cls: "fn-mobile-scheduled-context", text: model.contextLabel });
        this.renderKindChips(body);
        fields.text(body, "Title", this.options.data.title, (value) => (this.options.data.title = value));
        renderMobileTemporalSection(body, {
            mode: this.options.mode,
            data: this.options.data,
            fields,
            changed: (change) => this.changed(change),
            rerender: () => this.rerender(),
            onEventStartChanged: (value) => this.options.onPlannedStartChange?.(value),
            onManageTimeboxes: () => this.options.onManageTimeboxes?.(),
        });
        this.renderDescription(body);
        if (this.options.focusSummary) renderMobileFocusSummarySection(body, this.options.focusSummary);
        if (this.options.focusSessions && this.options.onEditFocusSession) {
            renderMobileFocusSessionsSection(body, this.options.focusSessions, this.options.onEditFocusSession);
        }
        if (this.options.mode === "edit" || this.options.mode === "create") {
            this.reflectionController = renderMobileReflectionSection(body, {
                app: this.options.app,
                data: this.options.data,
                targetFile: this.options.targetFile,
                getContextSources: this.options.getContextSources,
                update: (change) => this.changed(change),
            });
        }
        renderMobileDetailSection(body, {
            app: this.options.app,
            data: this.options.data,
            fields,
            defaultDetailNotesFolder: this.options.defaultDetailNotesFolder,
            rerender: () => this.rerender(),
            registerSuggester: (suggester) => this.registerSuggester(suggester),
        });
        if (model.showCreateTarget && this.options.createContext) {
            renderMobileTargetSection(body, {
                app: this.options.app,
                data: this.options.data,
                fields,
                context: this.options.createContext,
                getAllowedTaskSources: () => this.options.getAllowedTaskSources?.() ?? [],
                onTargetFileChange: (value) => this.controller?.setTargetFile(value),
                registerSuggester: (suggester) => this.registerSuggester(suggester),
            });
        }
        body.createDiv({
            cls: `fn-scheduled-item-form-error${this.errorMessage ? "" : " fn-gcal-hidden"}`,
            text: this.errorMessage,
            attr: { role: "alert", "aria-live": "polite" },
        });
        if (model.fieldsDisabled) this.lockFields(body);
    }

    private renderKindChips(body: HTMLElement): void {
        const onSwitchKind = this.options.onSwitchKind;
        if (this.options.mode !== "create" || !onSwitchKind) return;
        const currentKind = this.options.data.kind;
        const group = body.createDiv({
            cls: "fn-mobile-event-kind",
            attr: { role: "group", "aria-label": "Item type" },
        });
        const chips: Array<{ value: "inbox" | "event" | "task"; label: string }> = [
            { value: "inbox", label: "Moment" },
            { value: "event", label: "Event" },
            { value: "task", label: "Task" },
        ];
        for (const chip of chips) {
            const active = chip.value === currentKind;
            const button = group.createEl("button", {
                cls: `fn-mobile-event-kind-button${active ? " is-active" : ""}`,
                text: chip.label,
                attr: { type: "button", "aria-pressed": String(active) },
            });
            button.addEventListener("click", () => onSwitchKind(chip.value));
        }
    }

    private renderDescription(body: HTMLElement): void {
        const setting = new Setting(body)
            .setName("Description")
            .setDesc("Use @ for Object Notes, Tasks, or Events; @task and @event search stable block links.");
        const editor = setting.controlEl.createDiv({
            cls: "fn-mobile-event-description",
            attr: { role: "textbox", "aria-label": "Description", "aria-multiline": "true" },
        });
        this.controller = new ContextNotesController(this.options.app, editor, {
            initialValue: this.options.data.description,
            targetFile: this.options.targetFile,
            getContextSources: this.options.getContextSources,
            referenceFormat: "markdown-link",
            onChange: (value) => {
                this.options.data.description = value;
                this.options.data.objectReferences = parseObjectReferences(value).map((item) => item.reference);
                this.options.onChange(this.options.data);
            },
        });
    }

    private changed(change: () => void): void {
        change();
        this.options.onChange(this.options.data);
    }

    private rerender(): void {
        this.options.onChange(this.options.data);
        this.render();
    }

    private lockFields(body: HTMLElement): void {
        body.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>(
            "input, select, button",
        ).forEach((element) => {
            element.disabled = true;
        });
        body.querySelectorAll<HTMLElement>("[contenteditable]").forEach((element) => {
            element.contentEditable = "false";
            element.setAttribute("aria-disabled", "true");
        });
    }

    private registerSuggester(suggester: { close(): void }): void {
        this.register(() => suggester.close());
    }

    private registerViewportLifecycle(): void {
        const root = this.rootEl;
        if (!root) return;
        const viewport = window.visualViewport;
        const update = (): void => {
            const top = this.options.app.workspace.containerEl.getBoundingClientRect().top;
            const metrics = getMobileViewportMetrics(window.innerHeight, viewport ?? undefined, top, 8);
            root.style.setProperty("--fn-mobile-screen-height", `${metrics.height}px`);
            root.style.setProperty("--fn-mobile-screen-top", `${metrics.offsetTop}px`);
        };
        const reveal = (): void => {
            const active = document.activeElement;
            if (active instanceof HTMLElement && root.contains(active))
                window.setTimeout(() => active.scrollIntoView({ block: "nearest" }), 50);
        };
        update();
        this.registerDomEvent(window, "resize", update);
        this.registerDomEvent(window, "keydown", (event) => {
            if (event.key === "Escape") this.options.onCancel();
        });
        this.registerDomEvent(root, "focusin", reveal);
        if (viewport) {
            viewport.addEventListener("resize", update);
            viewport.addEventListener("scroll", update);
            // focusin fires before the on-screen keyboard finishes opening, so the initial
            // reveal() scrolls against pre-keyboard viewport bounds. Re-run it once the
            // keyboard's actual size lands via visualViewport's own resize event.
            viewport.addEventListener("resize", reveal);
            this.register(() => {
                viewport.removeEventListener("resize", update);
                viewport.removeEventListener("scroll", update);
                viewport.removeEventListener("resize", reveal);
            });
        }
    }
}
