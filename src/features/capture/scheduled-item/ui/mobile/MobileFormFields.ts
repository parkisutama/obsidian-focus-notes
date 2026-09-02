import { Setting } from "obsidian";
import { parseCanonicalValue } from "../../domain/DateTimeFormat.ts";
import { MobileDateTimePicker } from "./MobileDateTimePicker.ts";

export class MobileFormFields {
    constructor(private readonly changed: (change: () => void) => void) {}

    dateTime(
        container: HTMLElement,
        label: string,
        value: string | null,
        requireTime: boolean,
        onChange: (value: string | null) => void,
    ): Setting {
        // A field that doesn't strictly require time still shows it once its existing value
        // already carries one, matching the old native-input behavior exactly.
        const hasExistingTime = parseCanonicalValue(value)?.hour !== null && parseCanonicalValue(value)?.hour !== undefined;
        const setting = new Setting(container).setName(label);
        new MobileDateTimePicker({
            initialValue: value,
            requireTime: requireTime || hasExistingTime,
            ariaLabel: label,
            onChange: (next) => this.changed(() => onChange(next)),
        }).render(setting.controlEl);
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
