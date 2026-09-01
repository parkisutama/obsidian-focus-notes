import { type App, Component, Notice, setIcon } from "obsidian";
import type { ReflectionBlockFields } from "../../../../reflection/domain/ReflectionBlockLine.ts";
import { EmotionalWellbeingPicker } from "../../../../reflection/ui/EmotionalWellbeingPicker.ts";
import { InboxNotesController } from "../InboxNotesController.ts";
import type { MomentBlock } from "../../domain/MomentBlock.ts";
import type { MomentBlockEdit } from "../../domain/MomentBlockEditor.ts";
import {
    saveMomentBlock,
    type SaveMomentBlockResult,
} from "../../../../../infrastructure/obsidian/capture/MomentBlockPersistence.ts";
import type { LedgerRecordSnapshot } from "../../../scheduled-item/domain/LedgerRecordSource.ts";
import type { ContextSourceSettings } from "../../../../object-notes/domain/ContextSourceSettings.ts";
import { getMobileViewportMetrics } from "../../../scheduled-item/ui/mobile/MobileViewport.ts";

export interface MomentMobileEditScreenOptions {
    app: App;
    snapshot: LedgerRecordSnapshot;
    block: MomentBlock;
    getContextSources(): ContextSourceSettings[];
    onComplete: () => void;
}

/** Independent mobile full-screen editor for an existing Moment's Reflection fields. */
export class MomentMobileEditScreen extends Component {
    private rootEl: HTMLElement | null = null;
    private description: string;
    private reflection: ReflectionBlockFields;
    private reflectionNotes: string;
    private descriptionController: InboxNotesController | null = null;
    private reflectionNotesController: InboxNotesController | null = null;
    private saveButtonEl: HTMLButtonElement | null = null;
    private busy = false;

    constructor(private readonly options: MomentMobileEditScreenOptions) {
        super();
        this.description = options.block.description;
        this.reflection = { ...options.block.reflection };
        this.reflectionNotes = options.block.reflectionNotes ?? "";
    }

    open(owner?: Component): void {
        if (this.rootEl) return;
        this.rootEl = this.options.app.workspace.containerEl.createDiv({
            cls: "fn-mobile-event-screen fn-mobile-moment-edit-screen",
            attr: { role: "dialog", "aria-modal": "true", "aria-label": "Edit Moment" },
        });
        document.body.addClass("fn-mobile-event-screen-open");
        this.render();
        this.registerViewportLifecycle();
        if (owner) owner.addChild(this);
        else this.load();
    }

    close(): void {
        if (!this.rootEl) return;
        this.unload();
    }

    onunload(): void {
        this.descriptionController?.destroy();
        this.descriptionController = null;
        this.reflectionNotesController?.destroy();
        this.reflectionNotesController = null;
        this.rootEl?.remove();
        this.rootEl = null;
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

        const body = root.createEl("main", { cls: "fn-mobile-event-body" });

        const descriptionSection = body.createDiv({ cls: "fn-mobile-event-disclosure-content" });
        descriptionSection.createDiv({ cls: "fn-mobile-event-label", text: "Description" });
        const descriptionEl = descriptionSection.createDiv({
            cls: "fn-mobile-inbox-notes",
            attr: { role: "textbox", "aria-label": "Moment description" },
        });
        this.descriptionController = new InboxNotesController(this.options.app, descriptionEl, {
            initialValue: this.description,
            targetFile: this.options.snapshot.filePath,
            getContextSources: this.options.getContextSources,
            onChange: (value) => (this.description = value),
        });
        this.register(() => this.descriptionController?.destroy());

        const reflectionSection = body.createDiv({
            cls: "fn-mobile-event-disclosure-content fn-mobile-moment-reflection",
        });
        reflectionSection.createDiv({ cls: "fn-mobile-event-label", text: "Reflection" });
        new EmotionalWellbeingPicker(reflectionSection, (value) => (this.reflection = value), this.reflection);
        const reflectionNotesEl = reflectionSection.createDiv({
            cls: "fn-mobile-inbox-notes",
            attr: { role: "textbox", "aria-label": "Moment reflection notes" },
        });
        this.reflectionNotesController = new InboxNotesController(this.options.app, reflectionNotesEl, {
            initialValue: this.reflectionNotes,
            targetFile: this.options.snapshot.filePath,
            getContextSources: this.options.getContextSources,
            onChange: (value) => (this.reflectionNotes = value),
        });
        this.register(() => this.reflectionNotesController?.destroy());

        this.registerDomEvent(cancel, "click", () => this.close());
        this.registerDomEvent(save, "click", () => void this.submit());
    }

    private registerViewportLifecycle(): void {
        const root = this.rootEl;
        if (!root) return;
        const viewport = window.visualViewport;
        const updateViewport = (): void => {
            const workspaceTop = this.options.app.workspace.containerEl.getBoundingClientRect().top;
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
        if (this.busy) return;
        this.busy = true;
        this.saveButtonEl?.setAttribute("aria-busy", "true");
        this.saveButtonEl?.setText("Saving…");
        try {
            const edit: MomentBlockEdit = {
                description: this.description,
                reflection: this.reflection,
                reflectionNotes: this.reflectionNotes,
            };
            const result = await saveMomentBlock(this.options.app, this.options.snapshot, edit);
            if (result.status === "conflict" || result.status === "invalid") {
                new Notice(momentEditFailureMessage(result));
                return;
            }
            this.options.onComplete();
            this.close();
        } finally {
            this.busy = false;
            this.saveButtonEl?.setAttribute("aria-busy", "false");
            this.saveButtonEl?.setText("Save");
        }
    }
}

function momentEditFailureMessage(result: Exclude<SaveMomentBlockResult, { status: "saved" | "unchanged" }>): string {
    if (result.status === "invalid") return "This Moment block is ambiguous or invalid and cannot be saved.";
    return "This Moment's source changed or moved. Reopen and try again.";
}
