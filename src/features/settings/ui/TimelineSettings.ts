import { Setting } from "obsidian";
import { isTFile } from "../../../infrastructure/obsidian/ObsidianFileTypes.ts";
import { TargetResolver } from "../../../TargetResolver";
import { assessTimelineTargetGroups, buildTimelineSourceGroups } from "../../../TimelineSourceGroups";
import type { TimelineMode } from "../../timeline/domain/Timeline";
import type { SettingsRenderContext } from "./SettingsRenderContext";

export function renderFocusTimeline(containerEl: HTMLElement, ctx: SettingsRenderContext): void {
    containerEl.createEl("h3", { text: "Focus Timeline" });

    new Setting(containerEl)
        .setName("Enable Focus Timeline")
        .setDesc("Registers a separate timeline/planner view for markdown events and tasks.")
        .addToggle((toggle) =>
            toggle.setValue(ctx.settings.timeline.enabled).onChange(async (v) => {
                ctx.settings.timeline.enabled = v;
                await ctx.saveSettings();
            }),
        );

    new Setting(containerEl).setName("Default timeline mode").addDropdown((drop) =>
        drop
            .addOption("day", "Day")
            .addOption("multi-day", "Weekly View")
            .setValue(ctx.settings.timeline.defaultMode)
            .onChange(async (v) => {
                ctx.settings.timeline.defaultMode = v as TimelineMode;
                await ctx.saveSettings();
            }),
    );

    new Setting(containerEl)
        .setName("Weekly View span")
        .setDesc("Number of days shown in Weekly View.")
        .addText((text) =>
            text.setValue(String(ctx.settings.timeline.multiDaySpanDays)).onChange(async (v) => {
                const n = parseInt(v, 10);
                if (Number.isFinite(n) && n >= 2 && n <= 31) {
                    ctx.settings.timeline.multiDaySpanDays = n;
                    await ctx.saveSettings();
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
                .setValue(String(ctx.settings.timeline.weekStartsOn))
                .onChange(async (v) => {
                    const n = parseInt(v, 10);
                    if (Number.isFinite(n) && n >= 0 && n <= 6) {
                        ctx.settings.timeline.weekStartsOn = n;
                        await ctx.saveSettings();
                    }
                }),
        );

    new Setting(containerEl)
        .setName("Additional source folders")
        .setDesc(
            "Optional folders for non-object hub notes. Daily Notes and opted-in Object Sources are included automatically.",
        )
        .addTextArea((area) => {
            area.setValue(ctx.settings.timeline.sourceFolders.join("\n")).onChange(async (v) => {
                ctx.settings.timeline.sourceFolders = v
                    .split(/\r?\n/)
                    .map((line) => line.trim().replace(/^\/+|\/+$/g, ""))
                    .filter(Boolean);
                await ctx.saveSettings();
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
            area.setValue(ctx.settings.timeline.sourceHeadings.join("\n")).onChange(async (value) => {
                ctx.settings.timeline.sourceHeadings = value
                    .split(/\r?\n/)
                    .map((line) => line.trim())
                    .filter(Boolean);
                await ctx.saveSettings();
            });
            area.inputEl.rows = 3;
            area.inputEl.style.width = "100%";
        })
        .settingEl.addClass("fn-settings-wide-field");

    renderTimelineAlignmentStatus(containerEl, ctx);

    new Setting(containerEl).setName("Show completed tasks").addToggle((toggle) =>
        toggle.setValue(ctx.settings.timeline.showCompletedTasks).onChange(async (v) => {
            ctx.settings.timeline.showCompletedTasks = v;
            await ctx.saveSettings();
        }),
    );

    new Setting(containerEl)
        .setName("Show pending summary")
        .setDesc("Shows overdue unchecked due tasks above the timeline.")
        .addToggle((toggle) =>
            toggle.setValue(ctx.settings.timeline.showPendingSummary).onChange(async (v) => {
                ctx.settings.timeline.showPendingSummary = v;
                await ctx.saveSettings();
            }),
        );

    new Setting(containerEl).setName("Collapse source sidebar by default").addToggle((toggle) =>
        toggle.setValue(ctx.settings.timeline.sourceSidebarCollapsed).onChange(async (v) => {
            ctx.settings.timeline.sourceSidebarCollapsed = v;
            await ctx.saveSettings();
        }),
    );
}

function renderTimelineAlignmentStatus(container: HTMLElement, ctx: SettingsRenderContext): void {
    const settings = ctx.settings;
    const resolver = new TargetResolver(ctx.app, settings);
    const dailyFolder = resolver.getProfileFolder("daily");
    const groups = buildTimelineSourceGroups(
        settings.timeline.sourceFolders,
        dailyFolder,
        settings.inbox.contextSources,
    );
    const target = resolver.resolve(resolver.getActiveTarget()).file;
    const targetFile = ctx.app.vault.getAbstractFileByPath(target);
    const properties = isTFile(targetFile)
        ? (ctx.app.metadataCache.getFileCache(targetFile)?.frontmatter as Record<string, unknown> | undefined)
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
