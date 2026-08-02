import type { ScheduledItem, TimelineMode, TimelineRange } from "./ScheduledItemTypes";
import type { TimelineLayoutResult } from "./TimelineLayout";
import { addDays, formatDayKey, formatTime, startOfDay } from "./utils";

const HOUR_PX = 60;

export class TimelineGrid {
    private itemById: Map<string, ScheduledItem>;

    constructor(
        private parent: HTMLElement,
        private opts: {
            mode: TimelineMode;
            range: TimelineRange;
            items: ScheduledItem[];
            pendingItems: ScheduledItem[];
            layout: TimelineLayoutResult;
            sourceColors: Record<string, string>;
            showPendingSummary: boolean;
            openPendingSummary?: boolean;
            onOpenPendingSummary?: () => void;
            onOpenItem: (item: ScheduledItem) => void;
        },
    ) {
        this.itemById = new Map(opts.items.concat(opts.pendingItems).map((item) => [item.id, item]));
    }

    render(): void {
        this.parent.empty();
        const days = this.buildDays();
        const today = startOfDay(new Date());

        const root = this.parent.createDiv({ cls: "ftl-root" });

        this.renderHeaders(root, days, today);
        this.renderAlldayRow(root, days);

        const scroll = root.createDiv({ cls: "ftl-scroll" });
        this.renderCanvas(scroll, days, today);

        requestAnimationFrame(() => {
            const scrollbarWidth = Math.max(0, scroll.offsetWidth - scroll.clientWidth);
            root.style.setProperty("--ftl-scrollbar-width", `${scrollbarWidth}px`);
            const now = new Date();
            const minutes = now.getHours() * 60 + now.getMinutes();
            scroll.scrollTop = Math.max(0, ((minutes - 60) * HOUR_PX) / 60);
        });
    }

    private renderHeaders(parent: HTMLElement, days: Date[], today: Date): void {
        const header = parent.createDiv({ cls: "ftl-header" });
        header.createDiv({ cls: "ftl-corner" });

        for (const day of days) {
            const isToday = formatDayKey(day) === formatDayKey(today);
            const col = header.createDiv({
                cls: `ftl-day-header${isToday ? " ftl-day-header--today" : ""}`,
            });
            col.createDiv({
                cls: "ftl-day-weekday",
                text: day.toLocaleDateString(undefined, { weekday: "short" }),
            });
            const numEl = col.createDiv({
                cls: `ftl-day-num${isToday ? " ftl-day-num--today" : ""}`,
            });
            numEl.setText(String(day.getDate()));
            if (this.opts.mode === "day") {
                col.createDiv({
                    cls: "ftl-day-month",
                    text: day.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
                });
            }
        }
    }

    private renderAlldayRow(parent: HTMLElement, days: Date[]): void {
        const row = parent.createDiv({ cls: "ftl-allday-row" });
        const label = row.createDiv({ cls: "ftl-corner ftl-allday-label" });
        label.setText("all-day");

        for (const day of days) {
            const dayKey = formatDayKey(day);
            const col = row.createDiv({ cls: "ftl-allday-col" });

            if (this.shouldShowPendingHint(day)) {
                this.renderPendingHint(col);
            }

            for (const due of this.opts.layout.dues.filter((d) => d.dayKey === dayKey)) {
                const item = this.itemById.get(due.itemId);
                if (item) this.renderDueChip(col, item);
            }
        }
    }

    private renderCanvas(parent: HTMLElement, days: Date[], today: Date): void {
        const canvas = parent.createDiv({ cls: "ftl-canvas" });

        const timeCol = canvas.createDiv({ cls: "ftl-time-col" });
        this.renderTimeLabels(timeCol);

        const colArea = canvas.createDiv({ cls: "ftl-col-area" });

        for (let h = 1; h < 24; h++) {
            const line = colArea.createDiv({ cls: "ftl-hour-line" });
            line.style.top = `${h * HOUR_PX}px`;
        }
        for (let h = 0; h < 24; h++) {
            const half = colArea.createDiv({ cls: "ftl-half-line" });
            half.style.top = `${h * HOUR_PX + HOUR_PX / 2}px`;
        }

        for (const day of days) {
            const isToday = formatDayKey(day) === formatDayKey(today);
            this.renderDayCol(colArea, day, isToday);
        }
    }

    private renderTimeLabels(parent: HTMLElement): void {
        for (let h = 1; h < 24; h++) {
            const label = parent.createDiv({ cls: "ftl-hour-label" });
            label.style.top = `${h * HOUR_PX}px`;
            label.setText(`${String(h).padStart(2, "0")}:00`);
        }
    }

    private renderDayCol(parent: HTMLElement, day: Date, isToday: boolean): void {
        const dayKey = formatDayKey(day);
        const col = parent.createDiv({
            cls: `ftl-day-col${isToday ? " ftl-day-col--today" : ""}`,
        });

        if (isToday) {
            const now = new Date();
            const topPx = ((now.getHours() * 60 + now.getMinutes()) * HOUR_PX) / 60;
            const nowLine = col.createDiv({ cls: "ftl-now-line" });
            nowLine.style.top = `${topPx}px`;
            nowLine.createDiv({ cls: "ftl-now-dot" });
        }

        for (const block of this.opts.layout.blocks.filter((b) => b.dayKey === dayKey)) {
            const item = this.itemById.get(block.itemId);
            if (item) this.renderBlock(col, item, block.start, block.end, block.column, block.columnCount);
        }

        for (const point of this.opts.layout.points.filter((p) => formatDayKey(p.at) === dayKey)) {
            const item = this.itemById.get(point.itemId);
            if (item) this.renderPoint(col, item, point.at);
        }
    }

    private renderBlock(
        parent: HTMLElement,
        item: ScheduledItem,
        start: Date,
        end: Date,
        column: number,
        columnCount: number,
    ): void {
        const topPx = this.toPx(start);
        const heightPx = Math.max(20, this.toPx(end) - this.toPx(start));
        const gap = 2;
        const widthPct = 100 / columnCount;

        const block = parent.createEl("button", {
            cls: `ftl-block ftl-${item.kind}${item.isCompleted ? " ftl-completed" : ""}`,
        });
        block.style.top = `${topPx}px`;
        block.style.height = `${heightPx}px`;
        block.style.left = `calc(${column * widthPct}% + ${gap}px)`;
        block.style.width = `calc(${widthPct}% - ${gap * 2}px)`;
        block.style.setProperty("--ftl-color", this.colorFor(item));
        block.title = this.tooltip(item);
        block.toggleClass("ftl-block--compact", heightPx < 34);
        block.toggleClass("ftl-block--medium", heightPx >= 34 && heightPx < 56);
        block.toggleClass("ftl-block--roomy", heightPx >= 56);

        const body = block.createDiv({ cls: "ftl-block-body" });
        if (item.kind === "task") body.createSpan({ cls: "ftl-bullet", attr: { "aria-hidden": "true" } });
        const content = body.createDiv({ cls: "ftl-block-content" });
        content.createSpan({ cls: "ftl-block-title", text: item.title });

        if (heightPx >= 34) {
            content.createDiv({
                cls: "ftl-block-time",
                text: `${formatTime(start)} – ${formatTime(end)}`,
            });
        }

        if (heightPx > 72) {
            content.createDiv({ cls: "ftl-block-source", text: item.source.fileName });
        }

        block.addEventListener("click", () => this.opts.onOpenItem(item));
    }

    private renderPoint(parent: HTMLElement, item: ScheduledItem, at: Date): void {
        const topPx = this.toPx(at);

        const point = parent.createEl("button", {
            cls: `ftl-point ftl-${item.kind}${item.isCompleted ? " ftl-completed" : ""}`,
        });
        point.style.top = `${topPx}px`;
        point.style.setProperty("--ftl-color", this.colorFor(item));
        point.title = this.tooltip(item);

        if (item.kind === "task") point.createSpan({ cls: "ftl-bullet", attr: { "aria-hidden": "true" } });
        point.createSpan({
            cls: "ftl-point-text",
            text: `${formatTime(at)} ${item.title}`,
        });

        point.addEventListener("click", () => this.opts.onOpenItem(item));
    }

    private renderDueChip(parent: HTMLElement, item: ScheduledItem): void {
        const chip = parent.createEl("button", {
            cls: `ftl-due-chip ftl-${item.kind}${item.isCompleted ? " ftl-completed" : ""}`,
        });
        chip.style.setProperty("--ftl-color", this.colorFor(item));
        if (item.kind === "task")
            chip.createSpan({ cls: "ftl-bullet ftl-bullet--sm", attr: { "aria-hidden": "true" } });
        chip.createSpan({
            cls: "ftl-due-text",
            text: item.kind === "task" ? item.title : `${item.isCompleted ? "Done: " : "Due: "}${item.title}`,
        });
        chip.addEventListener("click", () => this.opts.onOpenItem(item));
    }

    private renderPendingHint(parent: HTMLElement): void {
        if (!this.opts.showPendingSummary || this.opts.pendingItems.length === 0) return;

        const wrap = parent.createDiv({ cls: "ftl-pending-wrap" });
        const btn = wrap.createEl("button", { cls: "ftl-pending-btn" });
        btn.createSpan({ cls: "ftl-pending-btn-check", attr: { "aria-hidden": "true" } });
        btn.createSpan({
            cls: "ftl-pending-btn-text",
            text: `${this.opts.pendingItems.length} pending tasks`,
        });
        btn.title = `${this.opts.pendingItems.length} pending tasks`;

        const preview = wrap.createDiv({ cls: "ftl-pending-preview" });
        const previewHead = preview.createDiv({ cls: "ftl-pending-head" });
        const titleWrap = previewHead.createDiv();
        titleWrap.createDiv({ cls: "ftl-pending-title", text: "Pending tasks" });
        titleWrap.createDiv({ cls: "ftl-pending-subtitle", text: "In the past 365 days" });
        const closeBtn = previewHead.createEl("button", {
            cls: "ftl-pending-close",
            attr: { "aria-label": "Close pending tasks" },
        });
        closeBtn.createSpan({ attr: { "aria-hidden": "true" } });

        for (const item of this.opts.pendingItems.slice(0, 8)) {
            const row = preview.createEl("button", { cls: "ftl-pending-row" });
            row.createDiv({ cls: "ftl-pending-check", attr: { "aria-hidden": "true" } });
            const body = row.createDiv({ cls: "ftl-pending-body" });
            body.createDiv({ cls: "ftl-pending-name", text: item.title });
            body.createDiv({
                cls: "ftl-pending-meta",
                text: this.formatPendingMeta(item),
            });
            row.addEventListener("click", () => this.opts.onOpenItem(item));
        }

        if (this.opts.pendingItems.length > 8) {
            preview.createDiv({
                cls: "ftl-pending-more",
                text: `+${this.opts.pendingItems.length - 8} more pending tasks`,
            });
        }

        btn.addEventListener("click", (event) => {
            event.stopPropagation();
            if (this.opts.mode === "day" && this.opts.onOpenPendingSummary) {
                this.opts.onOpenPendingSummary();
                return;
            }
            const shouldOpen = !wrap.hasClass("ftl-pending-open");
            if (shouldOpen) this.positionPendingPreview(btn, preview);
            wrap.toggleClass("ftl-pending-open", shouldOpen);
            if (shouldOpen) {
                window.setTimeout(() => {
                    document.addEventListener("click", () => wrap.removeClass("ftl-pending-open"), { once: true });
                });
            }
        });
        preview.addEventListener("click", (event) => event.stopPropagation());
        closeBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            wrap.removeClass("ftl-pending-open");
        });

        if (this.opts.openPendingSummary && this.opts.mode !== "day") {
            requestAnimationFrame(() => {
                this.positionPendingPreview(btn, preview);
                wrap.addClass("ftl-pending-open");
            });
        }
    }

    private positionPendingPreview(anchor: HTMLElement, preview: HTMLElement): void {
        const margin = 12;
        const rect = anchor.getBoundingClientRect();
        const width = Math.min(420, window.innerWidth - margin * 2);
        const left = Math.min(Math.max(margin, rect.left), Math.max(margin, window.innerWidth - width - margin));
        const top = Math.min(rect.bottom + 8, Math.max(margin, window.innerHeight - 120));
        preview.style.width = `${width}px`;
        preview.style.left = `${left}px`;
        preview.style.top = `${top}px`;
        preview.style.maxHeight = `${Math.max(220, window.innerHeight - top - margin)}px`;
    }

    private buildDays(): Date[] {
        const days: Date[] = [];
        let cursor = startOfDay(this.opts.range.start);
        while (cursor < this.opts.range.end) {
            days.push(cursor);
            cursor = addDays(cursor, 1);
        }
        return days;
    }

    private shouldShowPendingHint(day: Date): boolean {
        if (!this.opts.showPendingSummary || this.opts.pendingItems.length === 0) return false;
        const today = startOfDay(new Date());
        if (today >= this.opts.range.start && today < this.opts.range.end) {
            return formatDayKey(day) === formatDayKey(today);
        }
        return formatDayKey(day) === formatDayKey(this.opts.range.start);
    }

    private formatPendingMeta(item: ScheduledItem): string {
        const at = this.pendingAnchor(item);
        if (!at) return item.source.fileName;
        const due = startOfDay(at);
        const today = startOfDay(new Date());
        const days = Math.max(1, Math.round((today.getTime() - due.getTime()) / 86400000));
        const relative = days === 1 ? "Yesterday" : `${days} days ago`;
        return `${relative} · ${formatDayKey(at)} · ${item.source.fileName}`;
    }

    private pendingAnchor(item: ScheduledItem): Date | null {
        return item.due ?? item.end ?? item.start ?? item.remind;
    }

    private toPx(date: Date): number {
        return ((date.getHours() * 60 + date.getMinutes()) * HOUR_PX) / 60;
    }

    private colorFor(item: ScheduledItem): string {
        return this.opts.sourceColors[item.source.filePath] ?? "var(--interactive-accent)";
    }

    private tooltip(item: ScheduledItem): string {
        const heading = item.source.headingPath.length ? `\n${item.source.headingPath.join(" > ")}` : "";
        return `${item.title}\n${item.source.filePath}:${item.source.lineNumber}${heading}`;
    }
}
