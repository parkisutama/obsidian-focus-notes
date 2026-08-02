import { App, PluginSettingTab, Setting } from "obsidian";
import type FocusNotesPlugin from "./main";
import { InboxTargetMode, InsertPosition, TimelineMode } from "./types";
import { FileSuggest, FolderSuggest } from "./Suggesters";
import { normalizeInboxFolders } from "./InboxFolderSettings";

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
                        this.plugin.settings.liveTarget.file = "";
                        await this.plugin.saveSettings();
                        this.display();
                    })
            );

        new Setting(containerEl)
            .setName("Default file (template)")
            .setDesc(
                "Used when Daily Notes integration is off. " +
                    "Supports {{date}} and {{date:FORMAT}} tokens, e.g. Logs/{{date:YYYY/MM}}.md"
            )
            .addText(text => {
                text.setPlaceholder("Journal/{{date:YYYY-MM-DD}}.md")
                    .setValue(this.plugin.settings.defaultTarget.file)
                    .onChange(async v => {
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
                    "Created at level ## if missing."
            )
            .addText(text =>
                text
                    .setPlaceholder("Focus timeline")
                    .setValue(this.plugin.settings.defaultTarget.heading)
                    .onChange(async v => {
                        this.plugin.settings.defaultTarget.heading = v.trim();
                        this.plugin.settings.liveTarget.heading = "";
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
                        this.plugin.settings.liveTarget.position = v as InsertPosition;
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

        // ---- Inbox Quick Capture -------------------------------------------
        containerEl.createEl("h3", { text: "Inbox quick capture" });

        containerEl.createEl("p", {
            cls: "setting-item-description",
            text:
                "Choose where quick captures go and which folders provide " +
                "People and Place suggestions. These defaults can be overridden in Advanced."
        });

        new Setting(containerEl)
            .setName("Default destination")
            .setDesc("Use today's Daily Note or the active Event/Task target file.")
            .addDropdown(dropdown =>
                dropdown
                    .addOption("daily-note", "Daily Note")
                    .addOption("event-task-target", "Event/Task target")
                    .setValue(this.plugin.settings.inbox.defaultTargetMode)
                    .onChange(async value => {
                        this.plugin.settings.inbox.defaultTargetMode = value as InboxTargetMode;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Inbox heading")
            .setDesc("Heading text without #. A missing heading is created at level ##.")
            .addText(text =>
                text
                    .setPlaceholder("Inbox")
                    .setValue(this.plugin.settings.inbox.heading)
                    .onChange(async value => {
                        this.plugin.settings.inbox.heading =
                            value.replace(/^#+\s*/, "").trim() || "Inbox";
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Inbox insert position")
            .setDesc("Choose whether new captures appear at the top or bottom of the heading.")
            .addDropdown(dropdown =>
                dropdown
                    .addOption("end", "End of section (newest at bottom)")
                    .addOption("start", "Start of section (newest at top)")
                    .setValue(this.plugin.settings.inbox.position)
                    .onChange(async value => {
                        this.plugin.settings.inbox.position = value as InsertPosition;
                        await this.plugin.saveSettings();
                    })
            );

        this.renderInboxFolderList(
            containerEl,
            "People source folders",
            "Markdown notes in these folders and subfolders appear in @ suggestions as People.",
            this.plugin.settings.inbox.peopleFolders,
            async folders => {
                this.plugin.settings.inbox.peopleFolders = folders;
                await this.plugin.saveSettings();
            }
        );

        this.renderInboxFolderList(
            containerEl,
            "Place source folders",
            "Markdown notes in these folders and subfolders appear in @ suggestions as Places.",
            this.plugin.settings.inbox.placeFolders,
            async folders => {
                this.plugin.settings.inbox.placeFolders = folders;
                await this.plugin.saveSettings();
            }
        );

        // ---- Event & Task Creation -----------------------------------------
        containerEl.createEl("h3", { text: "Event & Task Creation" });

        containerEl.createEl("p", {
            cls: "setting-item-description",
            text:
                "Configure folders and default target heading used when creating events or tasks."
        });

        new Setting(containerEl)
            .setName("Hub notes folder")
            .setDesc(
                "Folder where new hub notes are created when choosing 'New note'. " +
                    "Created automatically if it doesn't exist."
            )
            .addText(text => {
                text
                    .setPlaceholder("Notes")
                    .setValue(this.plugin.settings.eventTask.hubNotesFolder)
                    .onChange(async v => {
                        this.plugin.settings.eventTask.hubNotesFolder = v.trim() || "Notes";
                        await this.plugin.saveSettings();
                    });
                new FolderSuggest(this.app, text.inputEl);
            });

        new Setting(containerEl)
            .setName("Default target heading")
            .setDesc(
                "Heading in the target file where event/task lines are inserted. " +
                    "Leave empty to append at end of file."
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

        new Setting(containerEl)
            .setName("Detail notes folder")
            .setDesc(
                "Folder where event/task detail notes are created (the third file, with full frontmatter). " +
                    "Created automatically if it doesn't exist."
            )
            .addText(text => {
                text
                    .setPlaceholder("Notes")
                    .setValue(this.plugin.settings.eventTask.detailNotesFolder)
                    .onChange(async v => {
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
                "Tokens: {{title}}, {{date}}, {{start}}, {{end}}, {{due}}, {{remind}}, {{description}}."
        });

        new Setting(containerEl)
            .setName("Event detail note template")
            .setDesc("Body template for event detail notes.")
            .addTextArea(area => {
                area.setValue(this.plugin.settings.eventTask.eventNoteTemplate).onChange(async v => {
                    this.plugin.settings.eventTask.eventNoteTemplate = v;
                    await this.plugin.saveSettings();
                });
                area.inputEl.rows = 5;
                area.inputEl.style.width = "100%";
            });

        new Setting(containerEl)
            .setName("Task detail note template")
            .setDesc("Body template for task detail notes.")
            .addTextArea(area => {
                area.setValue(this.plugin.settings.eventTask.taskNoteTemplate).onChange(async v => {
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
                    "{{date}} = event/task date, {{targetFile}} = target file path. Leave empty to omit this field."
            )
            .addText(text =>
                text
                    .setPlaceholder("[[{{date}}]]")
                    .setValue(this.plugin.settings.eventTask.relatedFieldFormat)
                    .onChange(async v => {
                        this.plugin.settings.eventTask.relatedFieldFormat = v.trim();
                        await this.plugin.saveSettings();
                    })
            );

        containerEl.createEl("h4", { text: "Detail note frontmatter fields" });

        new Setting(containerEl)
            .setName("Include 'status' field")
            .setDesc("Adds status: scheduled (event) / open (task) to the detail note frontmatter.")
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.eventTask.includeStatus).onChange(async v => {
                    this.plugin.settings.eventTask.includeStatus = v;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName("Include 'priority' field (task)")
            .setDesc("Adds priority: medium to the task detail note frontmatter.")
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.eventTask.includePriority).onChange(async v => {
                    this.plugin.settings.eventTask.includePriority = v;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName("Include 'tags' field")
            .setDesc("Adds tags: [event] or [task] to the detail note frontmatter.")
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.eventTask.includeTags).onChange(async v => {
                    this.plugin.settings.eventTask.includeTags = v;
                    await this.plugin.saveSettings();
                })
            );
    }

    private renderInboxFolderList(
        container: HTMLElement,
        title: string,
        description: string,
        folders: string[],
        save: (folders: string[]) => Promise<void>
    ): void {
        container.createEl("h4", { text: title });
        container.createEl("p", { text: description, cls: "setting-item-description" });
        const rows = container.createDiv({ cls: "fn-inbox-folder-settings" });
        const values = [...folders];
        let suggesters: FolderSuggest[] = [];

        const renderRows = (): void => {
            for (const suggester of suggesters) suggester.close();
            suggesters = [];
            rows.empty();

            values.forEach((folder, index) => {
                new Setting(rows)
                    .setName(`${title.replace(/s$/, "")} ${index + 1}`)
                    .addText(text => {
                        text
                            .setPlaceholder(
                                index === 0
                                    ? (title.startsWith("People") ? "People" : "Place")
                                    : "Folder/path"
                            )
                            .setValue(folder)
                            .onChange(async value => {
                                values[index] = value;
                                await save(normalizeInboxFolders(values));
                            });
                        text.inputEl.setAttribute("aria-label", `${title} ${index + 1}`);
                        suggesters.push(new FolderSuggest(this.app, text.inputEl));
                    })
                    .addExtraButton(button =>
                        button
                            .setIcon("trash-2")
                            .setTooltip(`Remove ${title.toLowerCase()} ${index + 1}`)
                            .onClick(async () => {
                                values.splice(index, 1);
                                await save(normalizeInboxFolders(values));
                                renderRows();
                            })
                    );
            });

            new Setting(rows).addButton(button =>
                button
                    .setButtonText("Add folder")
                    .setTooltip(`Add ${title.toLowerCase()}`)
                    .onClick(() => {
                        values.push("");
                        renderRows();
                        const inputs = rows.querySelectorAll<HTMLInputElement>("input");
                        inputs.item(inputs.length - 1)?.focus();
                    })
            );
        };

        renderRows();
    }
}
