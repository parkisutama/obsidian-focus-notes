import { type App, Modal, setIcon } from "obsidian";
import type { ScheduledItem } from "./ScheduledItemTypes";
import { buildPendingTaskModalModel, buildTimelineItemModalModel } from "./TimelineItemModalModel";

export class TimelineItemModal extends Modal {
    constructor(
        app: App,
        private item: ScheduledItem,
        private onOpenSource: (item: ScheduledItem) => void,
    ) {
        super(app);
    }

    onOpen(): void {
        const model = buildTimelineItemModalModel(this.item);
        this.modalEl.addClass("fn-timeline-item-modal");
        this.contentEl.empty();

        const eyebrow = this.contentEl.createDiv({ cls: "fn-timeline-modal-eyebrow" });
        eyebrow.createSpan({ text: model.kindLabel });
        eyebrow.createSpan({ text: model.statusLabel });
        this.contentEl.createEl("h2", { text: model.title });

        const details = this.contentEl.createDiv({ cls: "fn-timeline-modal-details" });
        this.renderDetail(details, "calendar-clock", "When", model.scheduleLabel);
        if (model.priorityLabel) this.renderDetail(details, "signal", "Priority", model.priorityLabel);
        this.renderDetail(details, "file-text", "Source", model.sourceLabel, model.sourcePath);

        const actions = this.contentEl.createDiv({ cls: "fn-timeline-modal-actions" });
        const close = actions.createEl("button", { text: "Close" });
        close.addEventListener("click", () => this.close());
        const open = actions.createEl("button", { cls: "mod-cta", text: "Open source note" });
        open.addEventListener("click", () => {
            this.close();
            this.onOpenSource(this.item);
        });
    }

    onClose(): void {
        this.contentEl.empty();
    }

    private renderDetail(parent: HTMLElement, icon: string, label: string, value: string, secondary?: string): void {
        const row = parent.createDiv({ cls: "fn-timeline-modal-detail" });
        const iconEl = row.createDiv({ cls: "fn-timeline-modal-detail-icon", attr: { "aria-hidden": "true" } });
        setIcon(iconEl, icon);
        const body = row.createDiv();
        body.createDiv({ cls: "fn-timeline-modal-detail-label", text: label });
        body.createDiv({ cls: "fn-timeline-modal-detail-value", text: value });
        if (secondary) body.createDiv({ cls: "fn-timeline-modal-detail-secondary", text: secondary });
    }
}

export class PendingTasksModal extends Modal {
    constructor(
        app: App,
        private items: ScheduledItem[],
        private onOpenItem: (item: ScheduledItem) => void,
    ) {
        super(app);
    }

    onOpen(): void {
        const model = buildPendingTaskModalModel(this.items);
        this.modalEl.addClass("fn-timeline-pending-modal");
        this.contentEl.empty();
        this.contentEl.createEl("h2", { text: model.title });
        this.contentEl.createDiv({ cls: "fn-timeline-pending-subtitle", text: model.subtitle });

        const list = this.contentEl.createDiv({ cls: "fn-timeline-pending-list" });
        for (const entry of model.items) {
            const row = list.createEl("button", { cls: "fn-timeline-pending-row" });
            row.createSpan({ cls: "fn-timeline-pending-check", attr: { "aria-hidden": "true" } });
            const body = row.createSpan({ cls: "fn-timeline-pending-body" });
            body.createSpan({ cls: "fn-timeline-pending-name", text: entry.item.title });
            body.createSpan({ cls: "fn-timeline-pending-meta", text: entry.meta });
            row.addEventListener("click", () => {
                this.close();
                this.onOpenItem(entry.item);
            });
        }
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
