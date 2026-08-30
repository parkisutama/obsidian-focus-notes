import { Setting, setIcon, ToggleComponent } from "obsidian";
import { createContextSource, findSharedFolderConflicts } from "../../../ContextSourceSettings";
import { normalizeInboxFolders } from "../../capture/moment/domain/InboxFolderSettings";
import { FileSuggest, FolderSuggest } from "../../../infrastructure/obsidian/suggestions/Suggesters";
import type { InsertPosition } from "../../../shared/markdown/InsertPosition";
import type { ContextSourceSettings, ObjectNotePlacement } from "../../object-notes/domain/ContextSourceSettings";
import { contextSelectField, contextTextField } from "./SettingsFormFields";
import type { SettingsRenderContext } from "./SettingsRenderContext";

/** Navigation between the Object Sources list and a single source's edit page. */
export interface ObjectSourceNavigation {
    toList: () => void;
    toSource: (sourceId: string) => void;
}

export function renderObjectsList(
    containerEl: HTMLElement,
    ctx: SettingsRenderContext,
    nav: ObjectSourceNavigation,
): void {
    containerEl.createEl("p", {
        cls: "setting-item-description",
        text:
            "Each source labels one object type. Match by folder and Match by property can each be turned on or " +
            "off independently — on their own, in combination, or neither (a source that matches nothing). " +
            "Multiple object types may share a folder when they use the same Property with distinct Values. " +
            "Templates are optional; enabled sources with a folder can create objects from the @ suggester.",
    });
    const sources = ctx.settings.inbox.contextSources;
    const list = containerEl.createDiv({ cls: "fn-settings-row-list" });
    sources.forEach((source, index) => {
        renderObjectSourceRow(list, source, index, ctx, nav);
    });

    new Setting(containerEl).addButton((button) =>
        button
            .setButtonText("Add object source")
            .setCta()
            .onClick(async () => {
                const created = createContextSource(sources);
                sources.push(created);
                await ctx.saveSettings();
                nav.toSource(created.id);
            }),
    );
}

function renderObjectSourceRow(
    container: HTMLElement,
    source: ContextSourceSettings,
    index: number,
    ctx: SettingsRenderContext,
    nav: ObjectSourceNavigation,
): void {
    const row = container.createDiv({ cls: "fn-settings-row" });
    const body = row.createDiv({ cls: "fn-settings-row-body" });
    body.createDiv({ cls: "fn-settings-row-title", text: source.name });
    body.createDiv({ cls: "fn-settings-row-desc", text: source.enabled ? "Enabled" : "Disabled" });

    const enabled = new ToggleComponent(row)
        .setValue(source.enabled)
        .setTooltip(`Enable ${source.name}`)
        .onChange(async (value) => {
            source.enabled = value;
            await ctx.saveSettings();
            ctx.redisplay();
        });
    enabled.toggleEl.addEventListener("click", (event) => event.stopPropagation());

    const remove = row.createEl("button", {
        cls: "clickable-icon",
        attr: { "aria-label": `Remove ${source.name}` },
    });
    setIcon(remove, "trash-2");
    remove.addEventListener("click", async (event) => {
        event.stopPropagation();
        ctx.settings.inbox.contextSources.splice(index, 1);
        await ctx.saveSettings();
        ctx.redisplay();
    });

    const arrow = row.createSpan({ cls: "fn-settings-row-arrow" });
    setIcon(arrow, "chevron-right");
    row.addEventListener("click", () => nav.toSource(source.id));
}

export function renderObjectSourceEdit(
    containerEl: HTMLElement,
    sourceId: string,
    ctx: SettingsRenderContext,
    nav: ObjectSourceNavigation,
): void {
    const sources = ctx.settings.inbox.contextSources;
    const index = sources.findIndex((s) => s.id === sourceId);
    const source = sources[index];
    if (!source) {
        nav.toList();
        return;
    }
    const sharedFolderConflicts = findSharedFolderConflicts(sources);
    const list = containerEl.createDiv({ cls: "fn-context-source-list" });
    renderContextSource(list, source, index, sharedFolderConflicts, ctx);
}

function renderContextSource(
    container: HTMLElement,
    source: ContextSourceSettings,
    index: number,
    sharedFolderConflicts: ReadonlyMap<string, string[]>,
    ctx: SettingsRenderContext,
): void {
    const card = container.createDiv({ cls: "fn-context-source-card" });
    const header = card.createDiv({ cls: "fn-context-source-header" });
    const identity = header.createDiv();
    identity.createEl("strong", { text: source.name });
    identity.createEl("small", { text: `ID: ${source.id}` });
    const actions = header.createDiv({ cls: "fn-context-source-actions" });
    new ToggleComponent(actions)
        .setValue(source.enabled)
        .setTooltip(`Enable ${source.name}`)
        .onChange(async (value) => {
            source.enabled = value;
            await ctx.saveSettings();
            ctx.redisplay();
        });
    const remove = actions.createEl("button", {
        cls: "clickable-icon",
        attr: { "aria-label": `Remove ${source.name}` },
    });
    setIcon(remove, "trash-2");
    remove.addEventListener("click", async () => {
        ctx.settings.inbox.contextSources.splice(index, 1);
        await ctx.saveSettings();
        ctx.redisplay();
    });

    let filterProperty = source.filter?.property ?? "";
    let filterValue = source.filter?.value ?? "";
    const saveFilter = async (): Promise<void> => {
        source.filter =
            filterProperty.trim() && filterValue.trim()
                ? { property: filterProperty.trim(), value: filterValue.trim() }
                : null;
        await ctx.saveSettings();
    };
    const fields = card.createDiv({ cls: "fn-context-source-grid" });
    contextTextField(fields, "Object label", "Books", source.name, async (value) => {
        source.name = value.trim() || source.id;
        identity.querySelector("strong")?.setText(source.name);
        await ctx.saveSettings();
    });
    contextTextField(fields, "Icon", "book-open", source.icon, async (value) => {
        source.icon = value.trim() || "link";
        await ctx.saveSettings();
    });
    const matchByFolderField = fields.createDiv({ cls: "fn-context-source-field" });
    matchByFolderField.createEl("span", { text: "Match by folder" });
    new ToggleComponent(matchByFolderField)
        .setValue(source.matchByFolder)
        .setTooltip(`Match ${source.name} by folder`)
        .onChange(async (value) => {
            source.matchByFolder = value;
            await ctx.saveSettings();
            ctx.redisplay();
        });
    const matchByPropertyField = fields.createDiv({ cls: "fn-context-source-field" });
    matchByPropertyField.createEl("span", { text: "Match by property" });
    new ToggleComponent(matchByPropertyField)
        .setValue(source.matchByProperty)
        .setTooltip(`Match ${source.name} by property`)
        .onChange(async (value) => {
            source.matchByProperty = value;
            await ctx.saveSettings();
            ctx.redisplay();
        });
    const propertyField = contextTextField(fields, "Property", "type", filterProperty, async (value) => {
        filterProperty = value;
        await saveFilter();
    });
    const valueField = contextTextField(fields, "Value", "book", filterValue, async (value) => {
        filterValue = value;
        await saveFilter();
    });
    propertyField.disabled = !source.matchByProperty;
    valueField.disabled = !source.matchByProperty;
    contextTextField(fields, "Log heading", "Reading log", source.relatedHeading, async (value) => {
        source.relatedHeading = value.replace(/^#+\s*/, "").trim() || "Related log";
        await ctx.saveSettings();
    });
    contextSelectField(
        fields,
        "Log position",
        [
            { value: "start", label: "Start of section (newest at top)" },
            { value: "end", label: "End of section (newest at bottom)" },
        ],
        source.relatedPosition,
        async (value) => {
            source.relatedPosition = value as InsertPosition;
            await ctx.saveSettings();
        },
    );
    contextSelectField(
        fields,
        "Default placement",
        [
            { value: "flat", label: "Flat note" },
            { value: "folder-note", label: "Folder note" },
        ],
        source.placement,
        async (value) => {
            source.placement = value as ObjectNotePlacement;
            await ctx.saveSettings();
        },
    );
    const timelineField = fields.createDiv({ cls: "fn-context-source-field" });
    timelineField.createEl("span", { text: "Include in Focus Timeline" });
    new ToggleComponent(timelineField)
        .setValue(source.includeInTimeline)
        .setTooltip(`Include ${source.name} in Focus Timeline`)
        .onChange(async (value) => {
            source.includeInTimeline = value;
            await ctx.saveSettings();
        });
    const template = contextTextField(
        fields,
        "Template note",
        "Templates/Book.md",
        source.templatePath,
        async (value) => {
            source.templatePath = value.trim().replace(/^\/+/, "");
            await ctx.saveSettings();
        },
    );
    new FileSuggest(ctx.app, template);

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

    renderContextSourceFolders(card, source, ctx);
}

function renderContextSourceFolders(
    container: HTMLElement,
    source: ContextSourceSettings,
    ctx: SettingsRenderContext,
): void {
    const rows = container.createDiv({ cls: "fn-context-source-folders" });
    rows.createEl("span", { cls: "fn-context-source-folders-label", text: "Source folders" });
    const list = rows.createDiv({ cls: "fn-context-source-folder-list" });
    const values = [...source.folders];
    const disabled = !source.matchByFolder;
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
            input.disabled = disabled;
            input.addEventListener("input", () => {
                values[index] = input.value;
                source.folders = normalizeInboxFolders(values);
            });
            input.addEventListener("change", async () => {
                await ctx.saveSettings();
            });
            suggesters.push(new FolderSuggest(ctx.app, input));
            const remove = row.createEl("button", {
                cls: "clickable-icon",
                attr: { "aria-label": `Remove ${source.name} folder ${index + 1}` },
            });
            remove.disabled = disabled;
            setIcon(remove, "x");
            remove.addEventListener("click", async () => {
                values.splice(index, 1);
                source.folders = normalizeInboxFolders(values);
                await ctx.saveSettings();
                renderRows();
            });
        });

        const add = list.createEl("button", { text: "+ Add folder", cls: "fn-context-source-add-folder" });
        add.disabled = disabled;
        add.addEventListener("click", () => {
            values.push("");
            renderRows();
            const inputs = list.querySelectorAll<HTMLInputElement>("input");
            inputs.item(inputs.length - 1)?.focus();
        });
    };

    renderRows();
}
