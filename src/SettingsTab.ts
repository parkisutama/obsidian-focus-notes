import { type App, type Plugin, PluginSettingTab, setIcon } from "obsidian";
import {
    renderEventCapture,
    renderMomentCapture,
    renderSharedNoteCreation,
    renderTaskCapture,
} from "./features/settings/ui/CaptureSettings";
import { renderFocusSession } from "./features/settings/ui/FocusSessionSettings";
import {
    type ObjectSourceNavigation,
    renderObjectsList,
    renderObjectSourceEdit,
} from "./features/settings/ui/ObjectSourceSettings";
import { renderPeriodicalNotes } from "./features/settings/ui/PeriodicalNotesSettings";
import type { SettingsRenderContext } from "./features/settings/ui/SettingsRenderContext";
import {
    CAPTURE_CATEGORIES,
    type FocusNotesSettingsViewId,
    type NavigableViewId,
    parentView,
    ROOT_CATEGORIES,
    type SettingsCategory,
} from "./SettingsLayout";
import { renderFocusTimeline } from "./features/settings/ui/TimelineSettings";
import type { FocusNotesSettings } from "./features/settings/domain/FocusNotesSettings";

type FocusNotesSettingsView = { id: NavigableViewId } | { id: "objects-source"; sourceId: string };

interface FocusNotesSettingsHost extends Plugin {
    settings: FocusNotesSettings;
    saveSettings(): Promise<void>;
}

export class FocusNotesSettingsTab extends PluginSettingTab {
    private view: FocusNotesSettingsView = { id: "root" };
    constructor(
        app: App,
        private plugin: FocusNotesSettingsHost,
    ) {
        super(app, plugin);
    }

    private navigateTo(id: NavigableViewId): void {
        this.view = { id };
        this.display();
    }

    private navigateToObjectSource(sourceId: string): void {
        this.view = { id: "objects-source", sourceId };
        this.display();
    }

    /** Narrow context passed to extracted category renderers instead of the whole plugin instance. */
    private settingsContext(): SettingsRenderContext {
        return {
            app: this.app,
            settings: this.plugin.settings,
            saveSettings: () => this.plugin.saveSettings(),
            redisplay: () => this.display(),
        };
    }

    private objectSourceNavigation(): ObjectSourceNavigation {
        return {
            toList: () => this.navigateTo("objects"),
            toSource: (sourceId) => this.navigateToObjectSource(sourceId),
        };
    }

    display(): void {
        const { containerEl } = this;
        const view = this.view;
        containerEl.empty();
        containerEl.createEl("h2", { text: "Focus Notes" });

        if (view.id === "root") {
            containerEl.createEl("p", {
                cls: "setting-item-description",
                text:
                    "These are defaults. The sidebar lets you override the Focus session target per session, " +
                    "so use these pages for your usual fallback (e.g. today's daily note).",
            });
            this.renderRoot(containerEl);
            return;
        }

        this.renderBackBar(containerEl, view);

        switch (view.id) {
            case "periodical":
                renderPeriodicalNotes(containerEl, this.settingsContext());
                return;
            case "objects":
                renderObjectsList(containerEl, this.settingsContext(), this.objectSourceNavigation());
                return;
            case "objects-source":
                renderObjectSourceEdit(
                    containerEl,
                    view.sourceId,
                    this.settingsContext(),
                    this.objectSourceNavigation(),
                );
                return;
            case "focus":
                renderFocusSession(containerEl, this.settingsContext());
                return;
            case "capture":
                this.renderCaptureList(containerEl);
                return;
            case "capture-moment":
                renderMomentCapture(containerEl, this.settingsContext());
                return;
            case "capture-event":
                renderEventCapture(containerEl, this.settingsContext());
                return;
            case "capture-task":
                renderTaskCapture(containerEl, this.settingsContext());
                return;
            case "capture-shared":
                renderSharedNoteCreation(containerEl, this.settingsContext());
                return;
            case "timeline":
                renderFocusTimeline(containerEl, this.settingsContext());
                return;
        }
    }

    private renderBackBar(containerEl: HTMLElement, view: Exclude<FocusNotesSettingsView, { id: "root" }>): void {
        const parent = parentView(view.id);
        if (!parent) return;
        const parentLabel = parent === "root" ? "Focus Notes" : this.categoryLabel(parent);
        const back = containerEl.createEl("button", { cls: "fn-settings-back", text: `← Back to ${parentLabel}` });
        back.addEventListener("click", () => this.navigateTo(parent));
        if (view.id === "objects-source") {
            const source = this.plugin.settings.inbox.contextSources.find((s) => s.id === view.sourceId);
            if (source) containerEl.createEl("p", { cls: "setting-item-description", text: `Editing: ${source.name}` });
        }
    }

    private categoryLabel(id: FocusNotesSettingsViewId): string {
        return (
            ROOT_CATEGORIES.find((c) => c.id === id)?.label ?? CAPTURE_CATEGORIES.find((c) => c.id === id)?.label ?? id
        );
    }

    private renderRoot(containerEl: HTMLElement): void {
        const list = containerEl.createDiv({ cls: "fn-settings-row-list" });
        for (const category of ROOT_CATEGORIES) {
            this.renderCategoryRow(list, category, () => this.navigateTo(category.id));
        }
    }

    private renderCaptureList(containerEl: HTMLElement): void {
        const list = containerEl.createDiv({ cls: "fn-settings-row-list" });
        for (const category of CAPTURE_CATEGORIES) {
            this.renderCategoryRow(list, category, () => this.navigateTo(category.id));
        }
    }

    private renderCategoryRow(container: HTMLElement, category: SettingsCategory, onClick: () => void): void {
        const row = container.createDiv({ cls: "fn-settings-row" });
        const body = row.createDiv({ cls: "fn-settings-row-body" });
        body.createDiv({ cls: "fn-settings-row-title", text: category.label });
        body.createDiv({ cls: "fn-settings-row-desc", text: category.description });
        const arrow = row.createSpan({ cls: "fn-settings-row-arrow" });
        setIcon(arrow, "chevron-right");
        row.addEventListener("click", onClick);
    }
}
