import type { ScheduledItem, TimelineSourceGroup } from "./ScheduledItemTypes";

export interface TimelineSourceSummary {
    id: string;
    name: string;
    scope: string;
    count: number;
    color: string;
    visible: boolean;
}

export function buildTimelineSourceSummaries(
    groups: TimelineSourceGroup[],
    activeItems: ScheduledItem[],
    visibility: Record<string, boolean>,
    colors: Record<string, string>,
    defaultColor: (sourceId: string) => string,
): TimelineSourceSummary[] {
    const counts = new Map<string, number>();
    const seenItems = new Set<string>();
    for (const item of activeItems) {
        if (seenItems.has(item.id)) continue;
        seenItems.add(item.id);
        counts.set(item.source.groupId, (counts.get(item.source.groupId) ?? 0) + 1);
    }

    return groups.map((group) => ({
        id: group.id,
        name: group.name,
        scope: group.folders.join(", "),
        count: counts.get(group.id) ?? 0,
        color: colors[group.id] ?? defaultColor(group.id),
        visible: visibility[group.id] ?? true,
    }));
}

export class TimelineSourceSidebar {
    private readonly parent: HTMLElement;
    private readonly opts: {
        sources: TimelineSourceSummary[];
        collapsed: boolean;
        onToggleSource: (sourceId: string, visible: boolean) => void;
        onToggleCollapsed: (collapsed: boolean) => void;
    };

    constructor(
        parent: HTMLElement,
        opts: {
            sources: TimelineSourceSummary[];
            collapsed: boolean;
            onToggleSource: (sourceId: string, visible: boolean) => void;
            onToggleCollapsed: (collapsed: boolean) => void;
        },
    ) {
        this.parent = parent;
        this.opts = opts;
    }

    render(): void {
        this.parent.empty();
        this.parent.toggleClass("focus-timeline-sidebar-collapsed", this.opts.collapsed);

        const header = this.parent.createDiv({ cls: "focus-timeline-sidebar-header" });
        header.createEl("span", { text: "Sources" });

        if (this.opts.collapsed) return;

        const list = this.parent.createDiv({ cls: "focus-timeline-source-list" });
        if (this.opts.sources.length === 0) {
            list.createDiv({
                cls: "focus-timeline-empty",
                text: "No scheduled items found in configured folders.",
            });
            return;
        }

        for (const source of this.opts.sources) {
            const row = list.createDiv({ cls: "focus-timeline-source-row" });
            row.style.setProperty("--focus-timeline-source-color", source.color);

            const toggle = row.createEl("input", { type: "checkbox" });
            toggle.checked = source.visible;
            toggle.addEventListener("change", () => {
                this.opts.onToggleSource(source.id, toggle.checked);
            });

            const label = row.createDiv({ cls: "focus-timeline-source-label" });
            label.createDiv({ cls: "focus-timeline-source-name", text: source.name });
            label.createDiv({ cls: "focus-timeline-source-path", text: source.scope });
            row.createDiv({ cls: "focus-timeline-source-count", text: String(source.count) });
        }
    }
}
