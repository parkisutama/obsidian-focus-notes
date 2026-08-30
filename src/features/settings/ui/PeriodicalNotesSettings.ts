import { Setting, setIcon } from "obsidian";
import { createPeriodicalProfile } from "../../periodical-notes/domain/PeriodicalNoteSettings";
import { FolderSuggest } from "../../../infrastructure/obsidian/suggestions/Suggesters";
import { TargetResolver } from "../../../infrastructure/obsidian/capture/TargetResolver";
import type { PeriodicalNoteProfile } from "../../periodical-notes/domain/PeriodicalNote";
import { contextTextField } from "./SettingsFormFields";
import type { SettingsRenderContext } from "./SettingsRenderContext";

export function renderPeriodicalNotes(containerEl: HTMLElement, ctx: SettingsRenderContext): void {
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
            'When the core Daily Notes plugin is enabled, the "Daily" profile\'s folder and file format ' +
                "are read from it live. Disabled, unavailable, or any other profile: its own fields below apply.",
        )
        .addToggle((toggle) =>
            toggle.setValue(ctx.settings.periodicalNotes.syncDailyFromCorePlugin).onChange(async (v) => {
                ctx.settings.periodicalNotes.syncDailyFromCorePlugin = v;
                await ctx.saveSettings();
            }),
        );

    new Setting(containerEl)
        .setName("Default date format")
        .setDesc("Moment.js format used for a bare {{date}} token (no explicit :FORMAT). Example: YYYY-MM-DD.")
        .addText((text) =>
            text.setValue(ctx.settings.dailyNoteFormat).onChange(async (v) => {
                ctx.settings.dailyNoteFormat = v || "YYYY-MM-DD";
                await ctx.saveSettings();
            }),
        );

    const list = containerEl.createDiv({ cls: "fn-periodical-profile-list" });
    const profiles = ctx.settings.periodicalNotes.profiles;
    profiles.forEach((profile, index) => {
        renderPeriodicalProfile(list, profile, index, ctx);
    });

    new Setting(containerEl).addButton((button) =>
        button
            .setButtonText("Add profile")
            .setCta()
            .onClick(async () => {
                profiles.push(createPeriodicalProfile(profiles));
                await ctx.saveSettings();
                ctx.redisplay();
            }),
    );
}

function renderPeriodicalProfile(
    container: HTMLElement,
    profile: PeriodicalNoteProfile,
    index: number,
    ctx: SettingsRenderContext,
): void {
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
        ctx.settings.periodicalNotes.profiles.splice(index, 1);
        await ctx.saveSettings();
        ctx.redisplay();
    });

    const fields = card.createDiv({ cls: "fn-periodical-profile-grid" });
    contextTextField(fields, "Name", "Monthly", profile.name, async (value) => {
        profile.name = value.trim() || profile.id;
        header.querySelector("strong")?.setText(profile.name);
        await ctx.saveSettings();
    });
    const preview = card.createDiv({ cls: "fn-periodical-profile-preview" });
    const updatePreview = (): void => {
        const target = new TargetResolver(ctx.app, ctx.settings).getPeriodicalTarget(profile.id, new Date());
        preview.setText(
            target?.file
                ? target.heading
                    ? `Today: ${target.file} → ## ${target.heading}`
                    : `Today: ${target.file}`
                : "Today: (unresolved — check the folder and file format below)",
        );
    };
    const folderInput = contextTextField(fields, "Folder", "Journal/{{date:YYYY}}", profile.folder, async (value) => {
        profile.folder = value.trim();
        await ctx.saveSettings();
        updatePreview();
    });
    new FolderSuggest(ctx.app, folderInput);
    contextTextField(fields, "File format", "YYYY-MM-DD", profile.fileFormat, async (value) => {
        profile.fileFormat = value.trim() || "YYYY-MM-DD";
        await ctx.saveSettings();
        updatePreview();
    });
    contextTextField(
        fields,
        "Heading format",
        "empty = fixed heading per capture kind",
        profile.headingFormat,
        async (value) => {
            profile.headingFormat = value.trim();
            await ctx.saveSettings();
            updatePreview();
        },
    );
    updatePreview();
}
