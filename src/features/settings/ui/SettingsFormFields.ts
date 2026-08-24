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
