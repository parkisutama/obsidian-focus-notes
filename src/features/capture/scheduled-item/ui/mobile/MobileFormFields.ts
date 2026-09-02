import { Setting } from "obsidian";

export class MobileFormFields {
    constructor(private readonly changed: (change: () => void) => void) {}

    dateTime(
        container: HTMLElement,
        label: string,
        value: string | null,
        requireTime: boolean,
        onChange: (value: string | null) => void,
    ): Setting {
        const [dateValue = "", timeValue = ""] = value?.split(" ") ?? [];
        const setting = new Setting(container).setName(label);
        const date = setting.controlEl.createEl("input", {
            type: "date",
            attr: { "aria-label": `${label} date`, lang: "en-GB" },
        });
        date.value = dateValue;
        let time: HTMLInputElement | null = null;
        if (requireTime || timeValue) {
            time = setting.controlEl.createEl("input", {
                type: "time",
                attr: { "aria-label": `${label} time`, lang: "en-GB" },
            });
            time.value = timeValue;
        }
        const emit = (): void =>
            this.changed(() => onChange(date.value ? `${date.value}${time?.value ? ` ${time.value}` : ""}` : null));
        date.addEventListener("change", emit);
        time?.addEventListener("change", emit);
        return setting;
    }

    text(
        container: HTMLElement,
        label: string,
        value: string,
        onChange: (value: string) => void,
        placeholder = "",
    ): HTMLInputElement {
        let input!: HTMLInputElement;
        new Setting(container).setName(label).addText((control) => {
            control
                .setValue(value)
                .setPlaceholder(placeholder)
                .onChange((next) => this.changed(() => onChange(next)));
            input = control.inputEl;
        });
        return input;
    }

    toggle(container: HTMLElement, label: string, value: boolean, onChange: (value: boolean) => void): void {
        new Setting(container)
            .setName(label)
            .addToggle((toggle) => toggle.setValue(value).onChange((next) => this.changed(() => onChange(next))));
    }
}
