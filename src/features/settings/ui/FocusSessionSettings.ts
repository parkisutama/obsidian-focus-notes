import { Setting } from "obsidian";
import type { InsertPosition } from "../../../shared/markdown/InsertPosition";
import { HeadingSuggest } from "../../../infrastructure/obsidian/suggestions/Suggesters.ts";
import { TargetResolver } from "../../../infrastructure/obsidian/capture/TargetResolver.ts";
import { renderProfilePicker } from "./SettingsFormFields";
import type { SettingsRenderContext } from "./SettingsRenderContext";

export function renderFocusSession(containerEl: HTMLElement, ctx: SettingsRenderContext): void {
    renderDefaultDurations(containerEl, ctx);
    renderFocusSessionCapture(containerEl, ctx);
    renderDateGrouping(containerEl, ctx);
    renderLogEntryFormat(containerEl, ctx);
    renderBehavior(containerEl, ctx);
}

function renderDefaultDurations(containerEl: HTMLElement, ctx: SettingsRenderContext): void {
    containerEl.createEl("h3", { text: "Default durations" });

    new Setting(containerEl)
        .setName("Pomodoro minutes")
        .setDesc("Default duration when the Pomodoro tab is active.")
        .addText((text) =>
            text.setValue(String(ctx.settings.pomodoroMinutes)).onChange(async (v) => {
                const n = parseFloat(v);
                if (Number.isFinite(n) && n > 0) {
                    ctx.settings.pomodoroMinutes = n;
                    await ctx.saveSettings();
                }
            }),
        );

    new Setting(containerEl)
        .setName("Timer minutes")
        .setDesc("Default duration when the Timer tab is active.")
        .addText((text) =>
            text.setValue(String(ctx.settings.timerMinutes)).onChange(async (v) => {
                const n = parseFloat(v);
                if (Number.isFinite(n) && n > 0) {
                    ctx.settings.timerMinutes = n;
                    await ctx.saveSettings();
                }
            }),
        );
}

function renderFocusSessionCapture(containerEl: HTMLElement, ctx: SettingsRenderContext): void {
    containerEl.createEl("h3", { text: "Focus session capture" });

    renderProfilePicker(
        containerEl,
        ctx,
        "Periodical note",
        "Which Periodical Notes profile Focus session logs land in by default. Define profiles on the " +
            "Periodical Notes tab.",
        ctx.settings.captureFocusSession.profileId,
        async (profileId) => {
            ctx.settings.captureFocusSession.profileId = profileId;
            await ctx.saveSettings();
        },
    );

    new Setting(containerEl)
        .setName("Heading")
        .setDesc(
            "Heading text (no #) under which entries land. Used when the chosen profile has no dated " +
                "per-period heading. Empty = append to end of file. Created at level ## if missing.",
        )
        .addText((text) => {
            text.setPlaceholder("Focus timeline")
                .setValue(ctx.settings.captureFocusSession.heading)
                .onChange(async (v) => {
                    ctx.settings.captureFocusSession.heading = v.trim();
                    await ctx.saveSettings();
                });
            // Scoped to the profile's today-resolved file so suggestions reflect whatever
            // note the chosen Periodical Notes profile currently points at.
            new HeadingSuggest(
                ctx.app,
                text.inputEl,
                () =>
                    new TargetResolver(ctx.settings).getPeriodicalTarget(
                        ctx.settings.captureFocusSession.profileId,
                    )?.file ?? "",
            );
        });

    new Setting(containerEl).setName("Insert position").addDropdown((drop) =>
        drop
            .addOption("end", "End of section (newest at bottom)")
            .addOption("start", "Start of section (newest at top)")
            .setValue(ctx.settings.captureFocusSession.position)
            .onChange(async (v) => {
                ctx.settings.captureFocusSession.position = v as InsertPosition;
                await ctx.saveSettings();
            }),
    );
}

function renderDateGrouping(containerEl: HTMLElement, ctx: SettingsRenderContext): void {
    containerEl.createEl("h3", { text: "Date grouping" });

    new Setting(containerEl)
        .setName("Group entries under date sub-headings")
        .setDesc(
            "When on, each session is placed under a date sub-heading inside the main heading. " +
                "When off, the date appears inside the bullet line. The sidebar's Group toggle controls this too.",
        )
        .addToggle((toggle) =>
            toggle.setValue(ctx.settings.groupByDate).onChange(async (v) => {
                ctx.settings.groupByDate = v;
                await ctx.saveSettings();
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
                .setValue(String(ctx.settings.dateSubHeadingLevel))
                .onChange(async (v) => {
                    const n = parseInt(v, 10);
                    if (n === 2 || n === 3 || n === 4) {
                        ctx.settings.dateSubHeadingLevel = n;
                        await ctx.saveSettings();
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
            text.setValue(ctx.settings.dateSubHeadingTemplate).onChange(async (v) => {
                ctx.settings.dateSubHeadingTemplate = v || "[[{{date}}]]";
                await ctx.saveSettings();
            }),
        );
}

function renderLogEntryFormat(containerEl: HTMLElement, ctx: SettingsRenderContext): void {
    containerEl.createEl("h3", { text: "Log entry format" });

    new Setting(containerEl)
        .setName("Flat template")
        .setDesc(
            "Used when date grouping is OFF. The date typically lives inside the bullet here. " +
                "Multi-line is supported — sub-bullets (4-space indent) become visual hierarchy. " +
                "Sub-bullets that resolve to no real content are pruned automatically.",
        )
        .addTextArea((area) => {
            area.setValue(ctx.settings.logFormatFlat).onChange(async (v) => {
                ctx.settings.logFormatFlat = v;
                await ctx.saveSettings();
            });
            area.inputEl.rows = 4;
            area.inputEl.style.width = "100%";
        })
        .settingEl.addClass("fn-settings-wide-field");

    new Setting(containerEl)
        .setName("Grouped template")
        .setDesc("Used when date grouping is ON. Drop {{date}} from this template — it's already in the sub-heading.")
        .addTextArea((area) => {
            area.setValue(ctx.settings.logFormatGrouped).onChange(async (v) => {
                ctx.settings.logFormatGrouped = v;
                await ctx.saveSettings();
            });
            area.inputEl.rows = 4;
            area.inputEl.style.width = "100%";
        })
        .settingEl.addClass("fn-settings-wide-field");

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
        ["{{links}}", "Always empty — kept for older templates; add links inline in {{notes}} instead"],
    ];
    for (const [token, desc] of placeholders) {
        const li = ul.createEl("li");
        li.createEl("code", { text: token });
        li.appendText(` — ${desc}`);
    }
}

function renderBehavior(containerEl: HTMLElement, ctx: SettingsRenderContext): void {
    containerEl.createEl("h3", { text: "Behavior" });

    new Setting(containerEl).setName("Auto-open log modal on countdown completion").addToggle((toggle) =>
        toggle.setValue(ctx.settings.autoOpenLogModal).onChange(async (v) => {
            ctx.settings.autoOpenLogModal = v;
            await ctx.saveSettings();
        }),
    );

    new Setting(containerEl).setName("Play sound on completion").addToggle((toggle) =>
        toggle.setValue(ctx.settings.playSound).onChange(async (v) => {
            ctx.settings.playSound = v;
            await ctx.saveSettings();
        }),
    );

    new Setting(containerEl)
        .setName("Recent entries to show")
        .setDesc("How many recent entries to surface in the sidebar preview.")
        .addText((text) =>
            text.setValue(String(ctx.settings.recentEntriesCount)).onChange(async (v) => {
                const n = parseInt(v, 10);
                if (Number.isFinite(n) && n >= 0 && n <= 50) {
                    ctx.settings.recentEntriesCount = n;
                    await ctx.saveSettings();
                }
            }),
        );
}
