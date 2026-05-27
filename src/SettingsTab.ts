import { App, PluginSettingTab, Setting } from "obsidian";
import type FocusNotesPlugin from "./main";
import { InsertPosition, TimelineMode } from "./types";
import { FileSuggest } from "./Suggesters";

export class FocusNotesSettingsTab extends PluginSettingTab {
    constructor(app: App, private plugin: FocusNotesPlugin) {
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
                "so use this page for your usual fallback (e.g. today's daily note)."
        });

        // ---- Default durations ------------------------------------------
        containerEl.createEl("h3", { text: "Default durations" });

        new Setting(containerEl)
            .setName("Pomodoro minutes")
            .setDesc("Default duration when the Pomodoro tab is active.")
            .addText(text =>
                text.setValue(String(this.plugin.settings.pomodoroMinutes)).onChange(async v => {
                    const n = parseFloat(v);
                    if (isFinite(n) && n > 0) {
                        this.plugin.settings.pomodoroMinutes = n;
                        await this.plugin.saveSettings();
                    }
                })
            );

        new Setting(containerEl)
            .setName("Timer minutes")
            .setDesc("Default duration when the Timer tab is active.")
            .addText(text =>
                text.setValue(String(this.plugin.settings.timerMinutes)).onChange(async v => {
                    const n = parseFloat(v);
                    if (isFinite(n) && n > 0) {
                        this.plugin.settings.timerMinutes = n;
                        await this.plugin.saveSettings();
                    }
                })
            );

        // ---- Default target ---------------------------------------------
        containerEl.createEl("h3", { text: "Default log target" });

        new Setting(containerEl)
            .setName("Use Daily Notes plugin settings")
            .setDesc(
                "When enabled, the default file is derived from the core Daily Notes plugin's " +
                    "folder + format (so today's note is always the fallback). When off, the manual " +
                    "path below is used."
            )
            .addToggle(toggle =>
                toggle
                    .setValue(this.plugin.settings.useDailyNotesAsDefault)
                    .onChange(async v => {
                        this.plugin.settings.useDailyNotesAsDefault = v;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Default file (template)")
            .setDesc(
                "Used when Daily Notes integration is off, or as the manual fallback. " +
                    "Supports {{date}} and {{date:FORMAT}} tokens, e.g. Logs/{{date:YYYY/MM}}.md"
            )
            .addText(text => {
                text.setPlaceholder("Journal/{{date:YYYY-MM-DD}}.md")
                    .setValue(this.plugin.settings.defaultTarget.file)
                    .onChange(async v => {
                        this.plugin.settings.defaultTarget.file = v.trim();
                        await this.plugin.saveSettings();
                    });
                new FileSuggest(this.app, text.inputEl);
            });

        new Setting(containerEl)
            .setName("Default heading")
            .setDesc(
                "Heading text (no #) under which entries land. Empty = append to end of file. " +
                    "Created at level ## if missing."
            )
            .addText(text =>
                text
                    .setPlaceholder("Focus timeline")
                    .setValue(this.plugin.settings.defaultTarget.heading)
                    .onChange(async v => {
                        this.plugin.settings.defaultTarget.heading = v.trim();
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Default insert position")
            .addDropdown(drop =>
                drop
                    .addOption("end", "End of section (newest at bottom)")
                    .addOption("start", "Start of section (newest at top)")
                    .setValue(this.plugin.settings.defaultTarget.position)
                    .onChange(async v => {
                        this.plugin.settings.defaultTarget.position = v as InsertPosition;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Daily-note date format")
            .setDesc(
                "Moment.js format used for the {{date}} token. Example: YYYY-MM-DD."
            )
            .addText(text =>
                text
                    .setValue(this.plugin.settings.dailyNoteFormat)
                    .onChange(async v => {
                        this.plugin.settings.dailyNoteFormat = v || "YYYY-MM-DD";
                        await this.plugin.saveSettings();
                    })
            );

        // ---- Date grouping ----------------------------------------------
        containerEl.createEl("h3", { text: "Date grouping" });

        new Setting(containerEl)
            .setName("Group entries under date sub-headings")
            .setDesc(
                "When on, each session is placed under a date sub-heading inside the main heading. " +
                    "When off, the date appears inside the bullet line. The sidebar's Group toggle controls this too."
            )
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.groupByDate).onChange(async v => {
                    this.plugin.settings.groupByDate = v;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName("Date sub-heading level")
            .setDesc("Number of # characters when the date sub-heading is created.")
            .addDropdown(drop =>
                drop
                    .addOption("2", "## (H2)")
                    .addOption("3", "### (H3) — recommended")
                    .addOption("4", "#### (H4)")
                    .setValue(String(this.plugin.settings.dateSubHeadingLevel))
                    .onChange(async v => {
                        const n = parseInt(v, 10);
                        if (n === 2 || n === 3 || n === 4) {
                            this.plugin.settings.dateSubHeadingLevel = n;
                            await this.plugin.saveSettings();
                        }
                    })
            );

        new Setting(containerEl)
            .setName("Date sub-heading template")
            .setDesc(
                "Text used for each date sub-heading. Default [[{{date}}]] auto-links to your daily note. " +
                    "Use {{date}} alone to drop the wikilink wrapping."
            )
            .addText(text =>
                text
                    .setValue(this.plugin.settings.dateSubHeadingTemplate)
                    .onChange(async v => {
                        this.plugin.settings.dateSubHeadingTemplate = v || "[[{{date}}]]";
                        await this.plugin.saveSettings();
                    })
            );

        // ---- Format ------------------------------------------------------
        containerEl.createEl("h3", { text: "Log entry format" });

        new Setting(containerEl)
            .setName("Flat template")
            .setDesc(
                "Used when date grouping is OFF. The date typically lives inside the bullet here. " +
                    "Multi-line is supported — sub-bullets (4-space indent) become visual hierarchy. " +
                    "Sub-bullets that resolve to no real content are pruned automatically."
            )
            .addTextArea(area => {
                area.setValue(this.plugin.settings.logFormatFlat).onChange(async v => {
                    this.plugin.settings.logFormatFlat = v;
                    await this.plugin.saveSettings();
                });
                area.inputEl.rows = 4;
                area.inputEl.style.width = "100%";
            });

        new Setting(containerEl)
            .setName("Grouped template")
            .setDesc(
                "Used when date grouping is ON. Drop {{date}} from this template — it's already in the sub-heading."
            )
            .addTextArea(area => {
                area.setValue(this.plugin.settings.logFormatGrouped).onChange(async v => {
                    this.plugin.settings.logFormatGrouped = v;
                    await this.plugin.saveSettings();
                });
                area.inputEl.rows = 4;
                area.inputEl.style.width = "100%";
            });

        const help = containerEl.createDiv({
            cls: "setting-item-description focus-notes-help"
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
            ["{{moodKey}}", "Mood canonical key (anxious, in-flow, …) — empty if skipped"],
            ["{{moodName}}", "Mood display name (Anxious, In Flow, …)"],
            ["{{moodEmoji}}", "Mood emoji"],
            ["{{moodTag}}", "Mood as Dataview-friendly tag #mood/anxious"],
            ["{{moodKeywords}}", "All mood keywords as space-separated #tags"],
            ["{{links}}", "Related links from the modal"]
        ];
        for (const [token, desc] of placeholders) {
            const li = ul.createEl("li");
            li.createEl("code", { text: token });
            li.appendText(` — ${desc}`);
        }

        // ---- Behavior ----------------------------------------------------
        containerEl.createEl("h3", { text: "Behavior" });

        new Setting(containerEl)
            .setName("Auto-open log modal on countdown completion")
            .addToggle(toggle =>
                toggle
                    .setValue(this.plugin.settings.autoOpenLogModal)
                    .onChange(async v => {
                        this.plugin.settings.autoOpenLogModal = v;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Play sound on completion")
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.playSound).onChange(async v => {
                    this.plugin.settings.playSound = v;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName("Recent entries to show")
            .setDesc("How many recent entries to surface in the sidebar preview.")
            .addText(text =>
                text
                    .setValue(String(this.plugin.settings.recentEntriesCount))
                    .onChange(async v => {
                        const n = parseInt(v, 10);
                        if (isFinite(n) && n >= 0 && n <= 50) {
                            this.plugin.settings.recentEntriesCount = n;
                            await this.plugin.saveSettings();
                        }
                    })
            );

        // ---- Focus Timeline ---------------------------------------------
        containerEl.createEl("h3", { text: "Focus Timeline" });

        new Setting(containerEl)
            .setName("Enable Focus Timeline")
            .setDesc("Registers a separate timeline/planner view for markdown events and tasks.")
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.timeline.enabled).onChange(async v => {
                    this.plugin.settings.timeline.enabled = v;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName("Default timeline mode")
            .addDropdown(drop =>
                drop
                    .addOption("day", "Day")
                    .addOption("multi-day", "Weekly View")
                    .setValue(this.plugin.settings.timeline.defaultMode)
                    .onChange(async v => {
                        this.plugin.settings.timeline.defaultMode = v as TimelineMode;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Weekly View span")
            .setDesc("Number of days shown in Weekly View.")
            .addText(text =>
                text
                    .setValue(String(this.plugin.settings.timeline.multiDaySpanDays))
                    .onChange(async v => {
                        const n = parseInt(v, 10);
                        if (isFinite(n) && n >= 2 && n <= 31) {
                            this.plugin.settings.timeline.multiDaySpanDays = n;
                            await this.plugin.saveSettings();
                        }
                    })
            );

        new Setting(containerEl)
            .setName("Week starts on")
            .setDesc("Used to align Weekly View. ISO week number remains ISO-8601.")
            .addDropdown(drop =>
                drop
                    .addOption("1", "Monday")
                    .addOption("0", "Sunday")
                    .addOption("6", "Saturday")
                    .setValue(String(this.plugin.settings.timeline.weekStartsOn))
                    .onChange(async v => {
                        const n = parseInt(v, 10);
                        if (isFinite(n) && n >= 0 && n <= 6) {
                            this.plugin.settings.timeline.weekStartsOn = n;
                            await this.plugin.saveSettings();
                        }
                    })
            );

        new Setting(containerEl)
            .setName("Source folders")
            .setDesc("One folder per line. Timeline indexing is disabled until at least one folder is configured.")
            .addTextArea(area => {
                area.setValue(this.plugin.settings.timeline.sourceFolders.join("\n")).onChange(async v => {
                    this.plugin.settings.timeline.sourceFolders = v
                        .split(/\r?\n/)
                        .map(line => line.trim().replace(/^\/+|\/+$/g, ""))
                        .filter(Boolean);
                    await this.plugin.saveSettings();
                });
                area.inputEl.rows = 5;
                area.inputEl.style.width = "100%";
            });

        new Setting(containerEl)
            .setName("Show completed tasks")
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.timeline.showCompletedTasks).onChange(async v => {
                    this.plugin.settings.timeline.showCompletedTasks = v;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName("Show pending summary")
            .setDesc("Shows overdue unchecked due tasks above the timeline.")
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.timeline.showPendingSummary).onChange(async v => {
                    this.plugin.settings.timeline.showPendingSummary = v;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName("Collapse source sidebar by default")
            .addToggle(toggle =>
                toggle
                    .setValue(this.plugin.settings.timeline.sourceSidebarCollapsed)
                    .onChange(async v => {
                        this.plugin.settings.timeline.sourceSidebarCollapsed = v;
                        await this.plugin.saveSettings();
                    })
            );

        // ---- Event & Task Creation -----------------------------------------
        containerEl.createEl("h3", { text: "Event & Task Creation" });

        containerEl.createEl("p", {
            cls: "setting-item-description",
            text:
                "Saat membuat event atau task lewat modal, pilih folder untuk catatan hub dan heading default tujuan."
        });

        new Setting(containerEl)
            .setName("Folder catatan hub")
            .setDesc(
                "Folder tempat catatan hub baru dibuat saat memilih 'Buat catatan baru'. " +
                    "Folder dibuat otomatis jika belum ada."
            )
            .addText(text =>
                text
                    .setPlaceholder("Notes")
                    .setValue(this.plugin.settings.eventTask.hubNotesFolder)
                    .onChange(async v => {
                        this.plugin.settings.eventTask.hubNotesFolder = v.trim() || "Notes";
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Heading default target")
            .setDesc(
                "Heading di file tujuan tempat baris event/task disisipkan. " +
                    "Kosongkan untuk langsung append ke akhir file."
            )
            .addText(text =>
                text
                    .setPlaceholder("Focus timeline")
                    .setValue(this.plugin.settings.eventTask.defaultSaveHeading)
                    .onChange(async v => {
                        this.plugin.settings.eventTask.defaultSaveHeading = v.trim();
                        await this.plugin.saveSettings();
                    })
            );
    }
}
