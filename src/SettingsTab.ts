import { type App, type Plugin, PluginSettingTab, Setting, setIcon } from "obsidian";
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
import { TargetResolver } from "./TargetResolver";
import { assessTimelineTargetGroups, buildTimelineSourceGroups } from "./TimelineSourceGroups";
import type { TimelineMode } from "./features/timeline/domain/Timeline";
import type { FocusNotesSettings } from "./features/settings/domain/FocusNotesSettings";
import { isTFile } from "./infrastructure/obsidian/ObsidianFileTypes.ts";

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
                this.renderFocusTimeline(containerEl);
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

    private renderFocusTimeline(containerEl: HTMLElement): void {
        containerEl.createEl("h3", { text: "Focus Timeline" });

        new Setting(containerEl)
            .setName("Enable Focus Timeline")
            .setDesc("Registers a separate timeline/planner view for markdown events and tasks.")
            .addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.timeline.enabled).onChange(async (v) => {
                    this.plugin.settings.timeline.enabled = v;
                    await this.plugin.saveSettings();
                }),
            );

        new Setting(containerEl).setName("Default timeline mode").addDropdown((drop) =>
            drop
                .addOption("day", "Day")
                .addOption("multi-day", "Weekly View")
                .setValue(this.plugin.settings.timeline.defaultMode)
                .onChange(async (v) => {
                    this.plugin.settings.timeline.defaultMode = v as TimelineMode;
                    await this.plugin.saveSettings();
                }),
        );

        new Setting(containerEl)
            .setName("Weekly View span")
            .setDesc("Number of days shown in Weekly View.")
            .addText((text) =>
                text.setValue(String(this.plugin.settings.timeline.multiDaySpanDays)).onChange(async (v) => {
                    const n = parseInt(v, 10);
                    if (Number.isFinite(n) && n >= 2 && n <= 31) {
                        this.plugin.settings.timeline.multiDaySpanDays = n;
                        await this.plugin.saveSettings();
                    }
                }),
            );

        new Setting(containerEl)
            .setName("Week starts on")
            .setDesc("Used to align Weekly View. ISO week number remains ISO-8601.")
            .addDropdown((drop) =>
                drop
                    .addOption("1", "Monday")
                    .addOption("0", "Sunday")
                    .addOption("6", "Saturday")
                    .setValue(String(this.plugin.settings.timeline.weekStartsOn))
                    .onChange(async (v) => {
                        const n = parseInt(v, 10);
                        if (Number.isFinite(n) && n >= 0 && n <= 6) {
                            this.plugin.settings.timeline.weekStartsOn = n;
                            await this.plugin.saveSettings();
                        }
                    }),
            );

        new Setting(containerEl)
            .setName("Additional source folders")
            .setDesc(
                "Optional folders for non-object hub notes. Daily Notes and opted-in Object Sources are included automatically.",
            )
            .addTextArea((area) => {
                area.setValue(this.plugin.settings.timeline.sourceFolders.join("\n")).onChange(async (v) => {
                    this.plugin.settings.timeline.sourceFolders = v
                        .split(/\r?\n/)
                        .map((line) => line.trim().replace(/^\/+|\/+$/g, ""))
                        .filter(Boolean);
                    await this.plugin.saveSettings();
                });
                area.inputEl.rows = 5;
                area.inputEl.style.width = "100%";
            })
            .settingEl.addClass("fn-settings-wide-field");

        new Setting(containerEl)
            .setName("Timeline headings")
            .setDesc(
                "Only scheduled Event and Task records below these headings are indexed. The current capture heading is always included.",
            )
            .addTextArea((area) => {
                area.setValue(this.plugin.settings.timeline.sourceHeadings.join("\n")).onChange(async (value) => {
                    this.plugin.settings.timeline.sourceHeadings = value
                        .split(/\r?\n/)
                        .map((line) => line.trim())
                        .filter(Boolean);
                    await this.plugin.saveSettings();
                });
                area.inputEl.rows = 3;
                area.inputEl.style.width = "100%";
            })
            .settingEl.addClass("fn-settings-wide-field");

        this.renderTimelineAlignmentStatus(containerEl);

        new Setting(containerEl).setName("Show completed tasks").addToggle((toggle) =>
            toggle.setValue(this.plugin.settings.timeline.showCompletedTasks).onChange(async (v) => {
                this.plugin.settings.timeline.showCompletedTasks = v;
                await this.plugin.saveSettings();
            }),
        );

        new Setting(containerEl)
            .setName("Show pending summary")
            .setDesc("Shows overdue unchecked due tasks above the timeline.")
            .addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.timeline.showPendingSummary).onChange(async (v) => {
                    this.plugin.settings.timeline.showPendingSummary = v;
                    await this.plugin.saveSettings();
                }),
            );

        new Setting(containerEl).setName("Collapse source sidebar by default").addToggle((toggle) =>
            toggle.setValue(this.plugin.settings.timeline.sourceSidebarCollapsed).onChange(async (v) => {
                this.plugin.settings.timeline.sourceSidebarCollapsed = v;
                await this.plugin.saveSettings();
            }),
        );
    }

    private renderTimelineAlignmentStatus(container: HTMLElement): void {
        const settings = this.plugin.settings;
        const resolver = new TargetResolver(this.app, settings);
        const dailyFolder = resolver.getProfileFolder("daily");
        const groups = buildTimelineSourceGroups(
            settings.timeline.sourceFolders,
            dailyFolder,
            settings.inbox.contextSources,
        );
        const target = resolver.resolve(resolver.getActiveTarget()).file;
        const targetFile = this.app.vault.getAbstractFileByPath(target);
        const properties = isTFile(targetFile)
            ? (this.app.metadataCache.getFileCache(targetFile)?.frontmatter as Record<string, unknown> | undefined)
            : undefined;
        const alignment = assessTimelineTargetGroups(target, properties, groups);
        const status = container.createDiv({ cls: "fn-timeline-alignment" });

        if (dailyFolder) {
            status.createDiv({ text: `Automatically indexed Daily Notes folder: ${dailyFolder}` });
        } else {
            status.createDiv({
                text: "Daily profile uses the vault root, has no folder configured, or could not be resolved; it is not auto-added.",
            });
        }

        if (alignment === "aligned") {
            status.addClass("is-success");
            status.createDiv({ text: `Default capture target is indexed: ${target}` });
        } else if (alignment === "mismatch") {
            status.addClass("is-warning");
            status.createDiv({ text: `Capture target is outside Timeline sources: ${target}` });
        } else if (alignment === "unconfigured") {
            status.addClass("is-warning");
            status.createDiv({ text: "Timeline has no folder-scoped source." });
        } else {
            status.addClass("is-warning");
            status.createDiv({ text: "The default capture target could not be resolved." });
        }
    }
}
