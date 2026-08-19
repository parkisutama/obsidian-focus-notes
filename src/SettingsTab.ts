import { type App, PluginSettingTab, Setting, setIcon } from "obsidian";
import { createContextSource, findSharedFolderConflicts } from "./ContextSourceSettings";
import { normalizeInboxFolders } from "./InboxFolderSettings";
import type FocusNotesPlugin from "./main";
import { createPeriodicalProfile } from "./PeriodicalNoteSettings";
import { type FocusNotesSettingsPage, settingsTabForSection } from "./SettingsLayout";
import { FileSuggest, FolderSuggest } from "./Suggesters";
import { TargetResolver } from "./TargetResolver";
import { assessTimelineTargetGroups, buildTimelineSourceGroups } from "./TimelineSourceGroups";
import type {
    ContextSourceSettings,
    InboxTargetMode,
    InsertPosition,
    ObjectNotePlacement,
    PeriodicalNoteProfile,
    TimelineMode,
} from "./types";
import { isTFile } from "./utils";

export class FocusNotesSettingsTab extends PluginSettingTab {
    private activePage: FocusNotesSettingsPage = "focus";
    constructor(
        app: App,
        private plugin: FocusNotesPlugin,
    ) {
        super(app, plugin);
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl("h2", { text: "Focus Notes" });

        containerEl.createEl("p", {
            cls: "setting-item-description",
            text:
                "These are defaults. The sidebar lets you override the target per session, " +
                "so use this page for your usual fallback (e.g. today's daily note).",
        });

        // ---- Default durations ------------------------------------------
        containerEl.createEl("h3", { text: "Default durations" });

        new Setting(containerEl)
            .setName("Pomodoro minutes")
            .setDesc("Default duration when the Pomodoro tab is active.")
            .addText((text) =>
                text.setValue(String(this.plugin.settings.pomodoroMinutes)).onChange(async (v) => {
                    const n = parseFloat(v);
                    if (Number.isFinite(n) && n > 0) {
                        this.plugin.settings.pomodoroMinutes = n;
                        await this.plugin.saveSettings();
                    }
                }),
            );

        new Setting(containerEl)
            .setName("Timer minutes")
            .setDesc("Default duration when the Timer tab is active.")
            .addText((text) =>
                text.setValue(String(this.plugin.settings.timerMinutes)).onChange(async (v) => {
                    const n = parseFloat(v);
                    if (Number.isFinite(n) && n > 0) {
                        this.plugin.settings.timerMinutes = n;
                        await this.plugin.saveSettings();
                    }
                }),
            );

        // ---- Default target ---------------------------------------------
        containerEl.createEl("h3", { text: "Default log target" });

        new Setting(containerEl)
            .setName("Use Daily Notes plugin settings")
            .setDesc(
                "When enabled, the default file is derived from the core Daily Notes plugin's " +
                    "folder + format (so today's note is always the fallback). When off, the manual " +
                    "path below is used.",
            )
            .addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.useDailyNotesAsDefault).onChange(async (v) => {
                    this.plugin.settings.useDailyNotesAsDefault = v;
                    this.plugin.settings.liveTarget.file = "";
                    await this.plugin.saveSettings();
                    this.display();
                }),
            );

        new Setting(containerEl)
            .setName("Default file (template)")
            .setDesc(
                "Used when Daily Notes integration is off. " +
                    "Supports {{date}} and {{date:FORMAT}} tokens, e.g. Logs/{{date:YYYY/MM}}.md",
            )
            .addText((text) => {
                text.setPlaceholder("Journal/{{date:YYYY-MM-DD}}.md")
                    .setValue(this.plugin.settings.defaultTarget.file)
                    .onChange(async (v) => {
                        this.plugin.settings.defaultTarget.file = v.trim();
                        this.plugin.settings.liveTarget.file = "";
                        await this.plugin.saveSettings();
                    });
                text.setDisabled(this.plugin.settings.useDailyNotesAsDefault);
                new FileSuggest(this.app, text.inputEl);
            });

        new Setting(containerEl)
            .setName("Default heading")
            .setDesc(
                "Heading text (no #) under which entries land. Empty = append to end of file. " +
                    "Created at level ## if missing.",
            )
            .addText((text) =>
                text
                    .setPlaceholder("Focus timeline")
                    .setValue(this.plugin.settings.defaultTarget.heading)
                    .onChange(async (v) => {
                        this.plugin.settings.defaultTarget.heading = v.trim();
                        this.plugin.settings.liveTarget.heading = "";
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl).setName("Default insert position").addDropdown((drop) =>
            drop
                .addOption("end", "End of section (newest at bottom)")
                .addOption("start", "Start of section (newest at top)")
                .setValue(this.plugin.settings.defaultTarget.position)
                .onChange(async (v) => {
                    this.plugin.settings.defaultTarget.position = v as InsertPosition;
                    this.plugin.settings.liveTarget.position = v as InsertPosition;
                    await this.plugin.saveSettings();
                }),
        );

        new Setting(containerEl)
            .setName("Daily-note date format")
            .setDesc("Moment.js format used for the {{date}} token. Example: YYYY-MM-DD.")
            .addText((text) =>
                text.setValue(this.plugin.settings.dailyNoteFormat).onChange(async (v) => {
                    this.plugin.settings.dailyNoteFormat = v || "YYYY-MM-DD";
                    await this.plugin.saveSettings();
                }),
            );

        // ---- Date grouping ----------------------------------------------
        containerEl.createEl("h3", { text: "Date grouping" });

        new Setting(containerEl)
            .setName("Group entries under date sub-headings")
            .setDesc(
                "When on, each session is placed under a date sub-heading inside the main heading. " +
                    "When off, the date appears inside the bullet line. The sidebar's Group toggle controls this too.",
            )
            .addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.groupByDate).onChange(async (v) => {
                    this.plugin.settings.groupByDate = v;
                    await this.plugin.saveSettings();
                }),
            );

        new Setting(containerEl)
            .setName("Date sub-heading level")
            .setDesc("Number of # characters when the date sub-heading is created.")
            .addDropdown((drop) =>
                drop
                    .addOption("2", "## (H2)")
                    .addOption("3", "### (H3) — recommended")
                    .addOption("4", "#### (H4)")
                    .setValue(String(this.plugin.settings.dateSubHeadingLevel))
                    .onChange(async (v) => {
                        const n = parseInt(v, 10);
                        if (n === 2 || n === 3 || n === 4) {
                            this.plugin.settings.dateSubHeadingLevel = n;
                            await this.plugin.saveSettings();
                        }
                    }),
            );

        new Setting(containerEl)
            .setName("Date sub-heading template")
            .setDesc(
                "Text used for each date sub-heading. Default [[{{date}}]] auto-links to your daily note. " +
                    "Use {{date}} alone to drop the wikilink wrapping.",
            )
            .addText((text) =>
                text.setValue(this.plugin.settings.dateSubHeadingTemplate).onChange(async (v) => {
                    this.plugin.settings.dateSubHeadingTemplate = v || "[[{{date}}]]";
                    await this.plugin.saveSettings();
                }),
            );

        // ---- Format ------------------------------------------------------
        containerEl.createEl("h3", { text: "Log entry format" });

        new Setting(containerEl)
            .setName("Flat template")
            .setDesc(
                "Used when date grouping is OFF. The date typically lives inside the bullet here. " +
                    "Multi-line is supported — sub-bullets (4-space indent) become visual hierarchy. " +
                    "Sub-bullets that resolve to no real content are pruned automatically.",
            )
            .addTextArea((area) => {
                area.setValue(this.plugin.settings.logFormatFlat).onChange(async (v) => {
                    this.plugin.settings.logFormatFlat = v;
                    await this.plugin.saveSettings();
                });
                area.inputEl.rows = 4;
                area.inputEl.style.width = "100%";
            });

        new Setting(containerEl)
            .setName("Grouped template")
            .setDesc(
                "Used when date grouping is ON. Drop {{date}} from this template — it's already in the sub-heading.",
            )
            .addTextArea((area) => {
                area.setValue(this.plugin.settings.logFormatGrouped).onChange(async (v) => {
                    this.plugin.settings.logFormatGrouped = v;
                    await this.plugin.saveSettings();
                });
                area.inputEl.rows = 4;
                area.inputEl.style.width = "100%";
            });

        const help = containerEl.createDiv({
            cls: "setting-item-description focus-notes-help",
        });
        help.createEl("strong", { text: "Placeholders" });
        const ul = help.createEl("ul");
        const placeholders: Array<[string, string]> = [
            ["{{date}}", "Date in the format above (use [[{{date}}]] for daily-note link)"],
            ["{{startTime}}", "Start time as HH:mm"],
            ["{{endTime}}", "End time as HH:mm"],
            ["{{startISO}}", "Start as full ISO timestamp"],
            ["{{endISO}}", "End as full ISO timestamp"],
            ["{{duration}}", "Human-readable duration (e.g. 25m 0s)"],
            ["{{durationMinutes}}", "Whole-minute duration"],
            ["{{durationSeconds}}", "Total seconds"],
            ["{{mode}}", "pomodoro, timer, or stopwatch"],
            ["{{task}}", "What are you doing — text or [[link]]"],
            ["{{notes}}", "Reflection and notes from the modal"],
            ["{{wellbeing}}", "Combined Emotional Wellbeing summary"],
            ["{{stressLevel}}", "Stress key: low, normal, medium, or high"],
            ["{{stressLabel}}", "Stress display label"],
            ["{{emotionCategory}}", "Emotion category key: pleasant, neutral, or unpleasant"],
            ["{{emotionCategoryName}}", "Emotion category display label"],
            ["{{emotionKey}}", "Specific emotion state key, if selected"],
            ["{{emotionName}}", "Specific emotion state display name"],
            ["{{emotionEmoji}}", "Specific emotion state emoji"],
            ["{{emotionTag}}", "Emotion state as Dataview-friendly tag #emotion/anxious"],
            ["{{moodKey}}", "Compatibility alias for {{emotionKey}}"],
            ["{{moodName}}", "Compatibility alias for {{emotionName}}"],
            ["{{moodEmoji}}", "Compatibility alias for {{emotionEmoji}}"],
            ["{{moodTag}}", "Compatibility alias for #mood/<emotionKey>"],
            ["{{moodKeywords}}", "Compatibility mood keywords as space-separated #tags"],
            ["{{links}}", "Related links from the modal"],
        ];
        for (const [token, desc] of placeholders) {
            const li = ul.createEl("li");
            li.createEl("code", { text: token });
            li.appendText(` — ${desc}`);
        }

        // ---- Behavior ----------------------------------------------------
        containerEl.createEl("h3", { text: "Behavior" });

        new Setting(containerEl).setName("Auto-open log modal on countdown completion").addToggle((toggle) =>
            toggle.setValue(this.plugin.settings.autoOpenLogModal).onChange(async (v) => {
                this.plugin.settings.autoOpenLogModal = v;
                await this.plugin.saveSettings();
            }),
        );

        new Setting(containerEl).setName("Play sound on completion").addToggle((toggle) =>
            toggle.setValue(this.plugin.settings.playSound).onChange(async (v) => {
                this.plugin.settings.playSound = v;
                await this.plugin.saveSettings();
            }),
        );

        new Setting(containerEl)
            .setName("Recent entries to show")
            .setDesc("How many recent entries to surface in the sidebar preview.")
            .addText((text) =>
                text.setValue(String(this.plugin.settings.recentEntriesCount)).onChange(async (v) => {
                    const n = parseInt(v, 10);
                    if (Number.isFinite(n) && n >= 0 && n <= 50) {
                        this.plugin.settings.recentEntriesCount = n;
                        await this.plugin.saveSettings();
                    }
                }),
            );

        // ---- Focus Timeline ---------------------------------------------
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
            });

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
            });

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

        // ---- Moment quick capture -------------------------------------------
        containerEl.createEl("h3", { text: "Moment quick capture" });

        containerEl.createEl("p", {
            cls: "setting-item-description",
            text:
                "Choose where quick Moment captures go and configure Object Sources for contextual @ suggestions, " +
                "historical logs, and future template-based object creation.",
        });

        new Setting(containerEl)
            .setName("Default destination")
            .setDesc(
                "Weekly note groups a week's Moments together under a per-day heading. Active note / capture target " +
                    "reuses the Event/Task destination. Daily Note always uses today's Daily Note.",
            )
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("weekly-note", "Weekly note")
                    .addOption("daily-note", "Daily Note")
                    .addOption("event-task-target", "Active note / capture target")
                    .setValue(this.plugin.settings.inbox.defaultTargetMode)
                    .onChange(async (value) => {
                        this.plugin.settings.inbox.defaultTargetMode = value as InboxTargetMode;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Weekly note folder")
            .setDesc(
                "Folder for the ISO weekly note. Set this to match wherever Journals already keeps weekly " +
                    "notes. May itself contain a {{date:FORMAT}} token for a year-scoped subfolder " +
                    "(e.g. timeline/{{date:GGGG}}), or repeat the weekly format for a Notebook Navigator " +
                    "folder note (e.g. Weekly/{{date:GGGG-[W]WW}}).",
            )
            .addText((text) => {
                text.setPlaceholder("Weekly")
                    .setValue(this.plugin.settings.inbox.weeklyNoteFolder)
                    .onChange(async (v) => {
                        this.plugin.settings.inbox.weeklyNoteFolder = v.trim();
                        await this.plugin.saveSettings();
                    });
                new FolderSuggest(this.app, text.inputEl);
            });

        new Setting(containerEl)
            .setName("Weekly note date format")
            .setDesc(
                "Moment.js format for the weekly note's file name, matched to your weekly-note plugin " +
                    "(Journals also uses Moment.js format tokens, so this can match its Note name template " +
                    "directly). Example: GGGG-[W]WW (ISO week-year and week number). Use GGGG, not YYYY, for " +
                    "the year token — YYYY is the plain calendar year and can name the wrong year on a week " +
                    "that spans a year boundary.",
            )
            .addText((text) =>
                text
                    .setPlaceholder("GGGG-[W]WW")
                    .setValue(this.plugin.settings.inbox.weeklyNoteFormat)
                    .onChange(async (v) => {
                        this.plugin.settings.inbox.weeklyNoteFormat = v.trim() || "GGGG-[W]WW";
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Weekly note heading format")
            .setDesc(
                "Moment.js format for the per-day heading inside the weekly note, independent of the " +
                    "Daily Note date format below. Example: YYYY-MM-DD.",
            )
            .addText((text) =>
                text
                    .setPlaceholder("YYYY-MM-DD")
                    .setValue(this.plugin.settings.inbox.weeklyHeadingFormat)
                    .onChange(async (v) => {
                        this.plugin.settings.inbox.weeklyHeadingFormat = v.trim() || "YYYY-MM-DD";
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Daily backlink heading")
            .setDesc(
                "When a Moment is saved to the weekly note, a backlink is also inserted under this heading " +
                    "in that day's Daily Note.",
            )
            .addText((text) =>
                text
                    .setPlaceholder("Moments")
                    .setValue(this.plugin.settings.inbox.dailyBacklinkHeading)
                    .onChange(async (v) => {
                        this.plugin.settings.inbox.dailyBacklinkHeading = v.trim() || "Moments";
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Moment heading")
            .setDesc("Heading text without #. A missing heading is created at level ##.")
            .addText((text) =>
                text
                    .setPlaceholder("Inbox")
                    .setValue(this.plugin.settings.inbox.heading)
                    .onChange(async (value) => {
                        this.plugin.settings.inbox.heading = value.replace(/^#+\s*/, "").trim() || "Inbox";
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Moment insert position")
            .setDesc("Choose whether new captures appear at the top or bottom of the heading.")
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("end", "End of section (newest at bottom)")
                    .addOption("start", "Start of section (newest at top)")
                    .setValue(this.plugin.settings.inbox.position)
                    .onChange(async (value) => {
                        this.plugin.settings.inbox.position = value as InsertPosition;
                        await this.plugin.saveSettings();
                    }),
            );

        this.renderContextSources(containerEl);

        // ---- Event & Task Creation -----------------------------------------
        containerEl.createEl("h3", { text: "Event & Task Creation" });

        containerEl.createEl("p", {
            cls: "setting-item-description",
            text: "Configure folders and default target heading used when creating events or tasks.",
        });

        new Setting(containerEl)
            .setName("Hub notes folder")
            .setDesc(
                "Folder where new hub notes are created when choosing 'New note'. " +
                    "Created automatically if it doesn't exist.",
            )
            .addText((text) => {
                text.setPlaceholder("Notes")
                    .setValue(this.plugin.settings.eventTask.hubNotesFolder)
                    .onChange(async (v) => {
                        this.plugin.settings.eventTask.hubNotesFolder = v.trim() || "Notes";
                        await this.plugin.saveSettings();
                    });
                new FolderSuggest(this.app, text.inputEl);
            });

        new Setting(containerEl)
            .setName("Default target heading")
            .setDesc(
                "Heading in the target file where event/task lines are inserted. " +
                    "Leave empty to append at end of file.",
            )
            .addText((text) =>
                text
                    .setPlaceholder("Focus timeline")
                    .setValue(this.plugin.settings.eventTask.defaultSaveHeading)
                    .onChange(async (v) => {
                        this.plugin.settings.eventTask.defaultSaveHeading = v.trim();
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Detail notes folder")
            .setDesc(
                "Folder where event/task detail notes are created (the third file, with full frontmatter). " +
                    "Created automatically if it doesn't exist.",
            )
            .addText((text) => {
                text.setPlaceholder("Notes")
                    .setValue(this.plugin.settings.eventTask.detailNotesFolder)
                    .onChange(async (v) => {
                        this.plugin.settings.eventTask.detailNotesFolder = v.trim() || "Notes";
                        await this.plugin.saveSettings();
                    });
                new FolderSuggest(this.app, text.inputEl);
            });

        containerEl.createEl("h4", { text: "Detail note templates" });

        containerEl.createEl("p", {
            cls: "setting-item-description",
            text:
                "Templates for event/task detail notes (the third file). " +
                "Created when 'Create a detail note' is checked in the modal. " +
                "Tokens: {{title}}, {{date}}, {{start}}, {{end}}, {{due}}, {{remind}}, {{description}}.",
        });

        new Setting(containerEl)
            .setName("Event detail note template")
            .setDesc("Body template for event detail notes.")
            .addTextArea((area) => {
                area.setValue(this.plugin.settings.eventTask.eventNoteTemplate).onChange(async (v) => {
                    this.plugin.settings.eventTask.eventNoteTemplate = v;
                    await this.plugin.saveSettings();
                });
                area.inputEl.rows = 5;
                area.inputEl.style.width = "100%";
            });

        new Setting(containerEl)
            .setName("Task detail note template")
            .setDesc("Body template for task detail notes.")
            .addTextArea((area) => {
                area.setValue(this.plugin.settings.eventTask.taskNoteTemplate).onChange(async (v) => {
                    this.plugin.settings.eventTask.taskNoteTemplate = v;
                    await this.plugin.saveSettings();
                });
                area.inputEl.rows = 5;
                area.inputEl.style.width = "100%";
            });

        new Setting(containerEl)
            .setName("Format of 'related' field")
            .setDesc(
                "Value of the related field in detail note frontmatter — points to the target daily note. " +
                    "{{date}} = event/task date, {{targetFile}} = target file path. Leave empty to omit this field.",
            )
            .addText((text) =>
                text
                    .setPlaceholder("[[{{date}}]]")
                    .setValue(this.plugin.settings.eventTask.relatedFieldFormat)
                    .onChange(async (v) => {
                        this.plugin.settings.eventTask.relatedFieldFormat = v.trim();
                        await this.plugin.saveSettings();
                    }),
            );

        containerEl.createEl("h4", { text: "Detail note frontmatter fields" });

        new Setting(containerEl)
            .setName("Include 'status' field")
            .setDesc("Adds the selected Event lifecycle status or Task open status to detail note frontmatter.")
            .addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.eventTask.includeStatus).onChange(async (v) => {
                    this.plugin.settings.eventTask.includeStatus = v;
                    await this.plugin.saveSettings();
                }),
            );

        new Setting(containerEl)
            .setName("Include 'priority' field (task)")
            .setDesc("Adds the selected Task priority to the detail note frontmatter.")
            .addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.eventTask.includePriority).onChange(async (v) => {
                    this.plugin.settings.eventTask.includePriority = v;
                    await this.plugin.saveSettings();
                }),
            );

        new Setting(containerEl)
            .setName("Include 'tags' field")
            .setDesc("Adds tags: [event] or [task] to the detail note frontmatter.")
            .addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.eventTask.includeTags).onChange(async (v) => {
                    this.plugin.settings.eventTask.includeTags = v;
                    await this.plugin.saveSettings();
                }),
            );

        this.renderPeriodicalNotes(containerEl);

        this.organizeSettingsTabs(containerEl);
    }

    private renderPeriodicalNotes(containerEl: HTMLElement): void {
        containerEl.createEl("h3", { text: "Periodical Notes" });
        containerEl.createEl("p", {
            cls: "setting-item-description",
            text:
                "Define where each kind of periodical note lives — daily, weekly, or any custom cadence. " +
                "Focus session, Event, and Task capture each pick one of these profiles as their destination.",
        });

        new Setting(containerEl)
            .setName("Sync Daily profile from core Daily Notes plugin")
            .setDesc(
                "When the core Daily Notes plugin is enabled, the \"Daily\" profile's folder and file format " +
                    "are read from it live. Disabled, unavailable, or any other profile: its own fields below apply.",
            )
            .addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.periodicalNotes.syncDailyFromCorePlugin).onChange(async (v) => {
                    this.plugin.settings.periodicalNotes.syncDailyFromCorePlugin = v;
                    await this.plugin.saveSettings();
                }),
            );

        const list = containerEl.createDiv({ cls: "fn-periodical-profile-list" });
        const profiles = this.plugin.settings.periodicalNotes.profiles;
        profiles.forEach((profile, index) => {
            this.renderPeriodicalProfile(list, profile, index);
        });

        new Setting(containerEl).addButton((button) =>
            button
                .setButtonText("Add profile")
                .setCta()
                .onClick(async () => {
                    profiles.push(createPeriodicalProfile(profiles));
                    await this.plugin.saveSettings();
                    this.display();
                }),
        );
    }

    private renderPeriodicalProfile(container: HTMLElement, profile: PeriodicalNoteProfile, index: number): void {
        const card = container.createDiv({ cls: "fn-periodical-profile-card" });
        const header = card.createDiv({ cls: "fn-periodical-profile-header" });
        header.createEl("strong", { text: profile.name || profile.id });
        header.createEl("small", { text: `ID: ${profile.id}` });
        const remove = header.createEl("button", {
            cls: "clickable-icon",
            attr: { "aria-label": `Remove ${profile.name || profile.id}` },
        });
        setIcon(remove, "trash-2");
        remove.addEventListener("click", async () => {
            this.plugin.settings.periodicalNotes.profiles.splice(index, 1);
            await this.plugin.saveSettings();
            this.display();
        });

        const fields = card.createDiv({ cls: "fn-periodical-profile-grid" });
        this.contextTextField(fields, "Name", "Monthly", profile.name, async (value) => {
            profile.name = value.trim() || profile.id;
            header.querySelector("strong")?.setText(profile.name);
            await this.plugin.saveSettings();
        });
        const folderInput = this.contextTextField(
            fields,
            "Folder",
            "Journal/{{date:YYYY}}",
            profile.folder,
            async (value) => {
                profile.folder = value.trim();
                await this.plugin.saveSettings();
            },
        );
        new FolderSuggest(this.app, folderInput);
        this.contextTextField(fields, "File format", "YYYY-MM-DD", profile.fileFormat, async (value) => {
            profile.fileFormat = value.trim() || "YYYY-MM-DD";
            await this.plugin.saveSettings();
        });
        this.contextTextField(
            fields,
            "Heading format",
            "empty = fixed heading per capture kind",
            profile.headingFormat,
            async (value) => {
                profile.headingFormat = value.trim();
                await this.plugin.saveSettings();
            },
        );
    }

    private renderTimelineAlignmentStatus(container: HTMLElement): void {
        const settings = this.plugin.settings;
        const resolver = new TargetResolver(this.app, settings);
        const dailyFolder = settings.useDailyNotesAsDefault ? resolver.getDailyNoteFolder() : null;
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
        } else if (settings.useDailyNotesAsDefault) {
            status.createDiv({
                text: "Daily Notes uses the vault root or could not be resolved; it is not auto-added.",
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

    private renderContextSources(container: HTMLElement): void {
        const section = container.createDiv({ cls: "fn-settings-object-section" });
        section.createEl("h3", { text: "Object Sources" });
        section.createEl("p", {
            cls: "setting-item-description",
            text:
                "Each source labels one object type. Folder scope is required; an optional property filter narrows matches. " +
                "Multiple object types may share a folder when they use the same Property with distinct Values. " +
                "Templates are optional; enabled sources with a folder can create objects from the @ suggester.",
        });
        const list = section.createDiv({ cls: "fn-context-source-list" });
        const sources = this.plugin.settings.inbox.contextSources;
        const sharedFolderConflicts = findSharedFolderConflicts(sources);

        sources.forEach((source, index) => {
            this.renderContextSource(list, source, index, sharedFolderConflicts);
        });
        new Setting(list).addButton((button) =>
            button
                .setButtonText("Add object source")
                .setCta()
                .onClick(async () => {
                    sources.push(createContextSource(sources));
                    await this.saveContextSources();
                    this.display();
                }),
        );
    }

    private renderContextSource(
        container: HTMLElement,
        source: ContextSourceSettings,
        index: number,
        sharedFolderConflicts: ReadonlyMap<string, string[]>,
    ): void {
        const card = container.createDiv({ cls: "fn-context-source-card" });
        const header = card.createDiv({ cls: "fn-context-source-header" });
        const identity = header.createDiv();
        identity.createEl("strong", { text: source.name });
        identity.createEl("small", { text: `ID: ${source.id}` });
        const actions = header.createDiv({ cls: "fn-context-source-actions" });
        const enabled = actions.createEl("input", {
            type: "checkbox",
            attr: { "aria-label": `Enable ${source.name}` },
        });
        enabled.checked = source.enabled;
        enabled.addEventListener("change", async () => {
            source.enabled = enabled.checked;
            await this.saveContextSources();
            this.display();
        });
        const remove = actions.createEl("button", {
            cls: "clickable-icon",
            attr: { "aria-label": `Remove ${source.name}` },
        });
        setIcon(remove, "trash-2");
        remove.addEventListener("click", async () => {
            this.plugin.settings.inbox.contextSources.splice(index, 1);
            await this.saveContextSources();
            this.display();
        });

        let filterProperty = source.filter?.property ?? "";
        let filterValue = source.filter?.value ?? "";
        const saveFilter = async (): Promise<void> => {
            source.filter =
                filterProperty.trim() && filterValue.trim()
                    ? { property: filterProperty.trim(), value: filterValue.trim() }
                    : null;
            await this.saveContextSources();
        };
        const fields = card.createDiv({ cls: "fn-context-source-grid" });
        this.contextTextField(fields, "Object label", "Books", source.name, async (value) => {
            source.name = value.trim() || source.id;
            identity.querySelector("strong")?.setText(source.name);
            await this.saveContextSources();
        });
        this.contextTextField(fields, "Icon", "book-open", source.icon, async (value) => {
            source.icon = value.trim() || "link";
            await this.saveContextSources();
        });
        this.contextTextField(fields, "Property", "type", filterProperty, async (value) => {
            filterProperty = value;
            await saveFilter();
        });
        this.contextTextField(fields, "Value", "book", filterValue, async (value) => {
            filterValue = value;
            await saveFilter();
        });
        this.contextTextField(fields, "Log heading", "Reading log", source.relatedHeading, async (value) => {
            source.relatedHeading = value.replace(/^#+\s*/, "").trim() || "Related log";
            await this.saveContextSources();
        });
        this.contextSelectField(
            fields,
            "Default placement",
            [
                { value: "flat", label: "Flat note" },
                { value: "folder-note", label: "Folder note" },
            ],
            source.placement,
            async (value) => {
                source.placement = value as ObjectNotePlacement;
                await this.saveContextSources();
            },
        );
        const timelineField = fields.createEl("label", { cls: "fn-context-source-field" });
        timelineField.createEl("span", { text: "Include in Focus Timeline" });
        const timelineToggle = timelineField.createEl("input", {
            type: "checkbox",
            attr: { "aria-label": `Include ${source.name} in Focus Timeline` },
        });
        timelineToggle.checked = source.includeInTimeline;
        timelineToggle.addEventListener("change", async () => {
            source.includeInTimeline = timelineToggle.checked;
            await this.saveContextSources();
        });
        const template = this.contextTextField(
            fields,
            "Template note",
            "Templates/Book.md",
            source.templatePath,
            async (value) => {
                source.templatePath = value.trim().replace(/^\/+/, "");
                await this.saveContextSources();
            },
        );
        new FileSuggest(this.app, template);

        const conflictingFolders = Array.from(sharedFolderConflicts.entries())
            .filter(([, sourceIds]) => sourceIds.includes(source.id))
            .map(([folder]) => folder);
        if (conflictingFolders.length > 0) {
            card.createDiv({
                cls: "fn-context-source-warning",
                text:
                    `Shared folder needs one common Property with a distinct Value for each object type: ` +
                    conflictingFolders.join(", "),
            });
        }

        this.renderContextSourceFolders(card, source);
    }

    private renderContextSourceFolders(container: HTMLElement, source: ContextSourceSettings): void {
        const rows = container.createDiv({ cls: "fn-context-source-folders" });
        rows.createEl("span", { cls: "fn-context-source-folders-label", text: "Source folders" });
        const list = rows.createDiv({ cls: "fn-context-source-folder-list" });
        const values = [...source.folders];
        let suggesters: FolderSuggest[] = [];

        const renderRows = (): void => {
            for (const suggester of suggesters) suggester.close();
            suggesters = [];
            list.empty();

            values.forEach((folder, index) => {
                const row = list.createDiv({ cls: "fn-context-source-folder-row" });
                const input = row.createEl("input", {
                    type: "text",
                    attr: {
                        placeholder: index === 0 ? "Objects" : "Folder/path",
                        "aria-label": `${source.name} source folder ${index + 1}`,
                    },
                });
                input.value = folder;
                input.addEventListener("input", () => {
                    values[index] = input.value;
                    source.folders = normalizeInboxFolders(values);
                });
                input.addEventListener("change", async () => {
                    await this.saveContextSources();
                });
                suggesters.push(new FolderSuggest(this.app, input));
                const remove = row.createEl("button", {
                    cls: "clickable-icon",
                    attr: { "aria-label": `Remove ${source.name} folder ${index + 1}` },
                });
                setIcon(remove, "x");
                remove.addEventListener("click", async () => {
                    values.splice(index, 1);
                    source.folders = normalizeInboxFolders(values);
                    await this.saveContextSources();
                    renderRows();
                });
            });

            const add = list.createEl("button", { text: "+ Add folder", cls: "fn-context-source-add-folder" });
            add.addEventListener("click", () => {
                values.push("");
                renderRows();
                const inputs = list.querySelectorAll<HTMLInputElement>("input");
                inputs.item(inputs.length - 1)?.focus();
            });
        };

        renderRows();
    }

    private contextTextField(
        container: HTMLElement,
        label: string,
        placeholder: string,
        value: string,
        onChange: (value: string) => Promise<void>,
    ): HTMLInputElement {
        const field = container.createEl("label", { cls: "fn-context-source-field" });
        field.createEl("span", { text: label });
        const input = field.createEl("input", { type: "text", attr: { placeholder, "aria-label": label } });
        input.value = value;
        input.addEventListener("change", () => void onChange(input.value));
        return input;
    }

    private contextSelectField(
        container: HTMLElement,
        label: string,
        options: Array<{ value: string; label: string }>,
        value: string,
        onChange: (value: string) => Promise<void>,
    ): HTMLSelectElement {
        const field = container.createEl("label", { cls: "fn-context-source-field" });
        field.createEl("span", { text: label });
        const select = field.createEl("select", { attr: { "aria-label": label } });
        for (const option of options) select.createEl("option", { value: option.value, text: option.label });
        select.value = value;
        select.addEventListener("change", () => void onChange(select.value));
        return select;
    }

    private organizeSettingsTabs(container: HTMLElement): void {
        const pages: Array<{ id: FocusNotesSettingsPage; label: string }> = [
            { id: "focus", label: "Focus" },
            { id: "timeline", label: "Timeline" },
            { id: "capture", label: "Capture" },
            { id: "periodical", label: "Periodical Notes" },
            { id: "objects", label: "Objects" },
        ];
        const nav = container.createDiv({ cls: "fn-settings-tabs", attr: { role: "tablist" } });
        const panels = new Map<FocusNotesSettingsPage, HTMLElement>();
        for (const page of pages) {
            panels.set(
                page.id,
                container.createDiv({
                    cls: "fn-settings-panel",
                    attr: { id: `fn-settings-${page.id}`, role: "tabpanel" },
                }),
            );
        }

        let current: FocusNotesSettingsPage = "focus";
        const movable = Array.from(container.children).filter(
            (child) => child !== nav && !child.classList.contains("fn-settings-panel") && child.tagName !== "H2",
        );
        movable.shift();
        for (const child of movable) {
            if (child.classList.contains("fn-settings-object-section")) current = "objects";
            else if (child.tagName === "H3") current = settingsTabForSection(child.textContent ?? "");
            panels.get(current)?.appendChild(child);
        }

        const activate = (page: FocusNotesSettingsPage): void => {
            this.activePage = page;
            for (const [id, panel] of panels) panel.toggleClass("fn-settings-panel-active", id === page);
            for (const button of Array.from(nav.querySelectorAll<HTMLButtonElement>("button[role=tab]"))) {
                const selected = button.dataset.page === page;
                button.toggleClass("is-active", selected);
                button.setAttribute("aria-selected", String(selected));
                button.tabIndex = selected ? 0 : -1;
            }
        };
        for (const page of pages) {
            const button = nav.createEl("button", {
                text: page.label,
                attr: {
                    role: "tab",
                    "aria-controls": `fn-settings-${page.id}`,
                    "data-page": page.id,
                },
            });
            button.addEventListener("click", () => activate(page.id));
        }
        container.querySelector("h2")?.insertAdjacentElement("afterend", nav);
        activate(this.activePage);
    }

    private async saveContextSources(): Promise<void> {
        await this.plugin.saveSettings();
    }
}
