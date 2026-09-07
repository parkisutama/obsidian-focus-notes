import { Setting } from "obsidian";
import { FolderSuggest } from "../../../infrastructure/obsidian/suggestions/Suggesters";
import type { InsertPosition } from "../../../shared/markdown/InsertPosition";
import type { DetailNotesFolderStrategy } from "../../capture/scheduled-item/domain/DetailNoteSettings.ts";
import { renderProfilePicker } from "./SettingsFormFields";
import type { SettingsRenderContext } from "./SettingsRenderContext";

export function renderMomentCapture(containerEl: HTMLElement, ctx: SettingsRenderContext): void {
    containerEl.createEl("h3", { text: "Moment capture" });

    containerEl.createEl("p", {
        cls: "setting-item-description",
        text:
            "Choose where quick Moment captures go and configure Object Sources for contextual @ suggestions, " +
            "historical logs, and future template-based object creation.",
    });

    new Setting(containerEl)
        .setName("Reuse Event's active target")
        .setDesc(
            "When on, Moment reuses whatever Event/Task's own active target resolves to (the note you " +
                "currently have open, or Event's configured default). When off, Moment uses the Periodical " +
                "Notes profile below instead.",
        )
        .addToggle((toggle) =>
            toggle.setValue(ctx.settings.captureMoment.useEventCaptureTarget).onChange(async (v) => {
                ctx.settings.captureMoment.useEventCaptureTarget = v;
                await ctx.saveSettings();
                ctx.redisplay();
            }),
        );

    if (!ctx.settings.captureMoment.useEventCaptureTarget) {
        renderProfilePicker(
            containerEl,
            ctx,
            "Periodical note",
            "Which Periodical Notes profile Moment captures land in. A profile with a per-period heading " +
                "format (e.g. Weekly) groups captures under a per-day heading automatically.",
            ctx.settings.captureMoment.profileId,
            async (profileId) => {
                ctx.settings.captureMoment.profileId = profileId;
                await ctx.saveSettings();
            },
        );
    }

    new Setting(containerEl)
        .setName("Heading")
        .setDesc(
            "Heading text without #. Used when reusing Event's target, or when the chosen profile has no " +
                "per-period heading format. A missing heading is created at level ##.",
        )
        .addText((text) =>
            text
                .setPlaceholder("Inbox")
                .setValue(ctx.settings.captureMoment.heading)
                .onChange(async (value) => {
                    ctx.settings.captureMoment.heading = value.replace(/^#+\s*/, "").trim() || "Inbox";
                    await ctx.saveSettings();
                }),
        );

    new Setting(containerEl)
        .setName("Insert position")
        .setDesc("Choose whether new captures appear at the top or bottom of the heading.")
        .addDropdown((dropdown) =>
            dropdown
                .addOption("end", "End of section (newest at bottom)")
                .addOption("start", "Start of section (newest at top)")
                .setValue(ctx.settings.captureMoment.position)
                .onChange(async (value) => {
                    ctx.settings.captureMoment.position = value as InsertPosition;
                    await ctx.saveSettings();
                }),
        );

    containerEl.createEl("h4", { text: "Same-day backlink" });
    containerEl.createEl("p", {
        cls: "setting-item-description",
        text:
            "Optionally leave a short backlink in another profile's file every time a Moment is captured " +
            "(e.g. a line in that day's Daily note pointing back at a Weekly Moment).",
    });

    new Setting(containerEl).setName("Enable backlink").addToggle((toggle) =>
        toggle.setValue(ctx.settings.captureMoment.backlink.enabled).onChange(async (v) => {
            ctx.settings.captureMoment.backlink.enabled = v;
            await ctx.saveSettings();
            ctx.redisplay();
        }),
    );

    if (ctx.settings.captureMoment.backlink.enabled) {
        renderProfilePicker(
            containerEl,
            ctx,
            "Backlink profile",
            "Which Periodical Notes profile receives the backlink.",
            ctx.settings.captureMoment.backlink.profileId,
            async (profileId) => {
                ctx.settings.captureMoment.backlink.profileId = profileId;
                await ctx.saveSettings();
            },
        );

        new Setting(containerEl)
            .setName("Backlink heading")
            .setDesc("Heading in the backlink profile's file where the backlink line is inserted.")
            .addText((text) =>
                text
                    .setPlaceholder("Moments")
                    .setValue(ctx.settings.captureMoment.backlink.heading)
                    .onChange(async (v) => {
                        ctx.settings.captureMoment.backlink.heading = v.trim() || "Moments";
                        await ctx.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Backlink position")
            .setDesc("Choose whether new backlinks appear at the top or bottom of the heading.")
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("start", "Start of section (newest at top)")
                    .addOption("end", "End of section (newest at bottom)")
                    .setValue(ctx.settings.captureMoment.backlink.position)
                    .onChange(async (v) => {
                        ctx.settings.captureMoment.backlink.position = v as InsertPosition;
                        await ctx.saveSettings();
                    }),
            );
    }
}

export function renderEventCapture(containerEl: HTMLElement, ctx: SettingsRenderContext): void {
    containerEl.createEl("h3", { text: "Event capture" });

    renderProfilePicker(
        containerEl,
        ctx,
        "Periodical note",
        "Which Periodical Notes profile new Events default to. Define profiles on the Periodical Notes tab.",
        ctx.settings.captureEvent.profileId,
        async (profileId) => {
            ctx.settings.captureEvent.profileId = profileId;
            await ctx.saveSettings();
        },
    );

    new Setting(containerEl)
        .setName("Heading")
        .setDesc(
            "Heading text where Event lines are inserted. Used when the chosen profile has no dated " +
                "per-period heading. Leave empty to append at end of file.",
        )
        .addText((text) =>
            text
                .setPlaceholder("Activities & Tasks")
                .setValue(ctx.settings.captureEvent.heading)
                .onChange(async (v) => {
                    ctx.settings.captureEvent.heading = v.trim();
                    await ctx.saveSettings();
                }),
        );

    new Setting(containerEl).setName("Insert position").addDropdown((drop) =>
        drop
            .addOption("end", "End of section (newest at bottom)")
            .addOption("start", "Start of section (newest at top)")
            .setValue(ctx.settings.captureEvent.position)
            .onChange(async (v) => {
                ctx.settings.captureEvent.position = v as InsertPosition;
                await ctx.saveSettings();
            }),
    );
}

export function renderTaskCapture(containerEl: HTMLElement, ctx: SettingsRenderContext): void {
    containerEl.createEl("h3", { text: "Task capture" });

    containerEl.createEl("p", {
        cls: "setting-item-description",
        text:
            "Task never defaults to a periodical note — it belongs in a Project or task-list page. Its " +
            '"Save to" picker draws from whichever Object Sources you allow below (combined); typing a ' +
            "path that doesn't match still works and shows the usual vault-wide suggestions.",
    });

    renderTaskAllowedSources(containerEl, ctx);

    new Setting(containerEl)
        .setName("Heading")
        .setDesc("Heading in the chosen note where Task lines are inserted. Leave empty to append at end of file.")
        .addText((text) =>
            text
                .setPlaceholder("Activities & Tasks")
                .setValue(ctx.settings.captureTask.heading)
                .onChange(async (v) => {
                    ctx.settings.captureTask.heading = v.trim();
                    await ctx.saveSettings();
                }),
        );

    new Setting(containerEl).setName("Insert position").addDropdown((drop) =>
        drop
            .addOption("end", "End of section (newest at bottom)")
            .addOption("start", "Start of section (newest at top)")
            .setValue(ctx.settings.captureTask.position)
            .onChange(async (v) => {
                ctx.settings.captureTask.position = v as InsertPosition;
                await ctx.saveSettings();
            }),
    );
}

/** Checklist of Object Sources allowed as Task "Save to" destinations. */
function renderTaskAllowedSources(container: HTMLElement, ctx: SettingsRenderContext): void {
    const sources = ctx.settings.inbox.contextSources;
    const desc =
        sources.length === 0
            ? "No Object Sources configured yet — add one below (Objects tab), then come back to allow it here."
            : 'Which Object Sources a Task\'s "Save to" picker draws from (combined). None checked = search ' +
              "the whole vault instead.";
    const setting = new Setting(container).setName("Allowed Object Sources").setDesc(desc);
    if (sources.length === 0) return;
    const list = setting.controlEl.createDiv({ cls: "fn-task-source-list" });
    for (const source of sources) {
        const label = list.createEl("label", { cls: "fn-task-source-option" });
        const checkbox = label.createEl("input", {
            type: "checkbox",
            attr: { "aria-label": `Allow ${source.name} as a Task destination` },
        });
        checkbox.checked = ctx.settings.captureTask.allowedSourceIds.includes(source.id);
        checkbox.addEventListener("change", async () => {
            const ids = ctx.settings.captureTask.allowedSourceIds;
            ctx.settings.captureTask.allowedSourceIds = checkbox.checked
                ? [...new Set([...ids, source.id])]
                : ids.filter((id) => id !== source.id);
            await ctx.saveSettings();
        });
        label.appendText(` ${source.name}`);
    }
}

export function renderSharedNoteCreation(containerEl: HTMLElement, ctx: SettingsRenderContext): void {
    containerEl.createEl("h3", { text: "Shared note creation" });

    containerEl.createEl("p", {
        cls: "setting-item-description",
        text: "Detail-note settings below apply to both Event and Task.",
    });

    new Setting(containerEl)
        .setName("Detail notes folder strategy")
        .setDesc(
            "How the folder is picked when creating a new event/task detail note (the third file, " +
                "with full frontmatter). Always just a starting suggestion — editable per note before saving.",
        )
        .addDropdown((drop) =>
            drop
                .addOption("sourceFolder", "Same folder as the note's Task/Event list")
                .addOption("configured", "Fixed folder below")
                .addOption("obsidianDefault", "Obsidian's Default location for new notes")
                .addOption("perKind", "Separate folder for Events and Tasks")
                .setValue(ctx.settings.eventTask.detailNotesFolderStrategy)
                .onChange(async (v) => {
                    ctx.settings.eventTask.detailNotesFolderStrategy = v as DetailNotesFolderStrategy;
                    await ctx.saveSettings();
                    ctx.redisplay();
                }),
        );

    if (ctx.settings.eventTask.detailNotesFolderStrategy === "configured") {
        new Setting(containerEl)
            .setName("Detail notes folder")
            .setDesc("Folder where new event/task detail notes are created. Created automatically if it doesn't exist.")
            .addText((text) => {
                text.setPlaceholder("Notes")
                    .setValue(ctx.settings.eventTask.detailNotesFolder)
                    .onChange(async (v) => {
                        ctx.settings.eventTask.detailNotesFolder = v.trim() || "Notes";
                        await ctx.saveSettings();
                    });
                new FolderSuggest(ctx.app, text.inputEl);
            });
    }

    if (ctx.settings.eventTask.detailNotesFolderStrategy === "sourceFolder") {
        new Setting(containerEl)
            .setName("Detail notes folder (Daily Notes fallback)")
            .setDesc(
                "Used only when the Task/Event's own list note is itself inside your Daily Notes folder — " +
                    "a Daily Note is just a place a Task passes through, not where its detail note should live.",
            )
            .addText((text) => {
                text.setPlaceholder("Notes")
                    .setValue(ctx.settings.eventTask.detailNotesFolder)
                    .onChange(async (v) => {
                        ctx.settings.eventTask.detailNotesFolder = v.trim() || "Notes";
                        await ctx.saveSettings();
                    });
                new FolderSuggest(ctx.app, text.inputEl);
            });
    }

    if (ctx.settings.eventTask.detailNotesFolderStrategy === "perKind") {
        new Setting(containerEl).setName("Event detail notes folder").addText((text) => {
            text.setPlaceholder("Notes")
                .setValue(ctx.settings.eventTask.detailNotesFolderEvent)
                .onChange(async (v) => {
                    ctx.settings.eventTask.detailNotesFolderEvent = v.trim() || "Notes";
                    await ctx.saveSettings();
                });
            new FolderSuggest(ctx.app, text.inputEl);
        });
        new Setting(containerEl).setName("Task detail notes folder").addText((text) => {
            text.setPlaceholder("Notes")
                .setValue(ctx.settings.eventTask.detailNotesFolderTask)
                .onChange(async (v) => {
                    ctx.settings.eventTask.detailNotesFolderTask = v.trim() || "Notes";
                    await ctx.saveSettings();
                });
            new FolderSuggest(ctx.app, text.inputEl);
        });
    }

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
            area.setValue(ctx.settings.eventTask.eventNoteTemplate).onChange(async (v) => {
                ctx.settings.eventTask.eventNoteTemplate = v;
                await ctx.saveSettings();
            });
            area.inputEl.rows = 5;
            area.inputEl.style.width = "100%";
        })
        .settingEl.addClass("fn-settings-wide-field");

    new Setting(containerEl)
        .setName("Task detail note template")
        .setDesc("Body template for task detail notes.")
        .addTextArea((area) => {
            area.setValue(ctx.settings.eventTask.taskNoteTemplate).onChange(async (v) => {
                ctx.settings.eventTask.taskNoteTemplate = v;
                await ctx.saveSettings();
            });
            area.inputEl.rows = 5;
            area.inputEl.style.width = "100%";
        })
        .settingEl.addClass("fn-settings-wide-field");

    new Setting(containerEl)
        .setName("Format of 'related' field")
        .setDesc(
            "Value of the related field in detail note frontmatter — points to the target daily note. " +
                "{{date}} = event/task date, {{targetFile}} = target file path. Leave empty to omit this field.",
        )
        .addText((text) =>
            text
                .setPlaceholder("[[{{date}}]]")
                .setValue(ctx.settings.eventTask.relatedFieldFormat)
                .onChange(async (v) => {
                    ctx.settings.eventTask.relatedFieldFormat = v.trim();
                    await ctx.saveSettings();
                }),
        );

    containerEl.createEl("h4", { text: "Detail note frontmatter fields" });

    new Setting(containerEl)
        .setName("Include 'status' field")
        .setDesc("Adds the selected Event lifecycle status or Task open status to detail note frontmatter.")
        .addToggle((toggle) =>
            toggle.setValue(ctx.settings.eventTask.includeStatus).onChange(async (v) => {
                ctx.settings.eventTask.includeStatus = v;
                await ctx.saveSettings();
            }),
        );

    new Setting(containerEl)
        .setName("Include 'priority' field (task)")
        .setDesc("Adds the selected Task priority to the detail note frontmatter.")
        .addToggle((toggle) =>
            toggle.setValue(ctx.settings.eventTask.includePriority).onChange(async (v) => {
                ctx.settings.eventTask.includePriority = v;
                await ctx.saveSettings();
            }),
        );

    new Setting(containerEl)
        .setName("Include 'tags' field")
        .setDesc("Adds tags: [event] or [task] to the detail note frontmatter.")
        .addToggle((toggle) =>
            toggle.setValue(ctx.settings.eventTask.includeTags).onChange(async (v) => {
                ctx.settings.eventTask.includeTags = v;
                await ctx.saveSettings();
            }),
        );
}
