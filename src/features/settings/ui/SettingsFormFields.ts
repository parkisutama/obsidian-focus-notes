import { Setting } from "obsidian";
import type { SettingsRenderContext } from "./SettingsRenderContext";

/** Dropdown of Periodical Notes profiles. Shared by Focus/Event/Moment capture category renderers. */
export function renderProfilePicker(
    container: HTMLElement,
    ctx: SettingsRenderContext,
    name: string,
    desc: string,
    currentProfileId: string,
    onChange: (profileId: string) => Promise<void>,
): void {
    const profiles = ctx.settings.periodicalNotes.profiles;
    new Setting(container)
        .setName(name)
        .setDesc(desc)
        .addDropdown((dropdown) => {
            if (profiles.length === 0) dropdown.addOption("", "No profiles defined yet");
            for (const profile of profiles) dropdown.addOption(profile.id, profile.name || profile.id);
            dropdown.setValue(currentProfileId).onChange(onChange);
        });
}

/** Labeled text input row. Shared by Periodical Notes and Object Source category renderers. */
export function contextTextField(
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

/** Labeled select row. Shared by Object Source category renderers. */
export function contextSelectField(
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
