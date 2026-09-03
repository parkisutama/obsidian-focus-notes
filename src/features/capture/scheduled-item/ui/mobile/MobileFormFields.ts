import { Setting } from "obsidian";
import { parseCanonicalValue } from "../../domain/DateTimeFormat.ts";
import { DateTimeInput } from "../../../../../infrastructure/obsidian/datetime/DateTimeInput.ts";

export class MobileFormFields {
    private readonly pickers: DateTimeInput[] = [];

    constructor(private readonly changed: (change: () => void) => void) {}

    /** Destroys every DateTimeInput this instance created — flatpickr keeps document-level listeners and a detached calendar element alive until told to stop, so callers must invoke this before discarding a render pass. */
    destroyPickers(): void {
        for (const picker of this.pickers) picker.destroy();
        this.pickers.length = 0;
    }

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
        this.pickers.push(
            new DateTimeInput(setting.controlEl, {
                initialValue: value,
                requireTime: requireTime || hasExistingTime,
                ariaLabel: label,
                onChange: (next) => this.changed(() => onChange(next)),
            }),
        );
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
