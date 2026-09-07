import { setIcon } from "obsidian";
import { MOODS, type MoodEntry } from "../domain/MoodReference";
import type { EmotionCategory, StressLevel } from "../domain/Wellbeing";
import {
    EMOTION_GROUPS,
    getEmotionCategoryLabel,
    getStressLevelLabel,
    STRESS_OPTIONS,
} from "../domain/EmotionalWellbeingReference";

export interface EmotionalWellbeingValue {
    stressLevel: StressLevel | null;
    emotionCategory: EmotionCategory | null;
    emotionKey: string | null;
}

export class EmotionalWellbeingPicker {
    private container: HTMLElement;
    private stressLevel: StressLevel | null = null;
    private emotionCategory: EmotionCategory | null = null;
    private emotionKey: string | null = null;
    private emotionStatesEl!: HTMLElement;
    private summaryEl!: HTMLElement;
    private categoryButtons = new Map<EmotionCategory, HTMLElement>();

    constructor(
        parent: HTMLElement,
        private onChange: (value: EmotionalWellbeingValue) => void,
        initial?: EmotionalWellbeingValue,
    ) {
        this.stressLevel = initial?.stressLevel ?? null;
        this.emotionCategory = initial?.emotionCategory ?? null;
        this.emotionKey = initial?.emotionKey ?? null;
        this.container = parent.createDiv({ cls: "fn-wellbeing-picker" });
        this.renderStress();
        this.renderEmotionCategories();
        this.emotionStatesEl = this.container.createDiv({ cls: "fn-wellbeing-states" });
        this.summaryEl = this.container.createDiv({ cls: "fn-mood-summary" });
        this.refreshCategoryButtons();
        this.renderEmotionStates();
        this.refreshSummary();
    }

    private renderStress(): void {
        const group = this.container.createDiv({ cls: "fn-wellbeing-group" });
        const header = group.createDiv({ cls: "fn-wellbeing-group-header" });
        header.createDiv({ cls: "fn-wellbeing-group-label", text: "Stress" });
        const value = header.createSpan({
            cls: "fn-wellbeing-current",
            text: getStressLevelLabel(this.stressLevel) || "Not set",
        });
        const slider = group.createEl("input", {
            cls: "fn-wellbeing-stress-slider",
            type: "range",
            attr: {
                min: "0",
                max: String(STRESS_OPTIONS.length),
                step: "1",
                value: String(
                    this.stressLevel ? STRESS_OPTIONS.findIndex((item) => item.level === this.stressLevel) + 1 : 0,
                ),
                "aria-label": "Stress level",
                "aria-valuetext": getStressLevelLabel(this.stressLevel) || "Not set",
            },
        });
        const labels = group.createDiv({ cls: "fn-wellbeing-stress-labels", attr: { "aria-hidden": "true" } });
        labels.createSpan({ text: "None" });
        for (const option of STRESS_OPTIONS) labels.createSpan({ text: option.label });
        slider.addEventListener("input", () => {
            const index = Number(slider.value) - 1;
            this.stressLevel = index >= 0 ? (STRESS_OPTIONS[index]?.level ?? null) : null;
            const label = getStressLevelLabel(this.stressLevel) || "Not set";
            value.setText(label);
            slider.setAttribute("aria-valuetext", label);
            this.emitChange();
            this.refreshSummary();
        });
    }

    private renderEmotionCategories(): void {
        const group = this.container.createDiv({ cls: "fn-wellbeing-group" });
        group.createDiv({ cls: "fn-wellbeing-group-label", text: "Emotion" });
        const row = group.createDiv({ cls: "fn-wellbeing-segment-row" });
        for (const option of EMOTION_GROUPS) {
            const btn = row.createEl("button", {
                cls: "fn-wellbeing-segment",
                text: option.label,
            });
            btn.addEventListener("click", () => this.setEmotionCategory(option.category));
            this.categoryButtons.set(option.category, btn);
        }
    }

    private setEmotionCategory(category: EmotionCategory): void {
        this.emotionCategory = category;
        const group = EMOTION_GROUPS.find((item) => item.category === category);
        if (!group?.keys.includes(this.emotionKey ?? "")) {
            this.emotionKey = null;
        }
        this.refreshCategoryButtons();
        this.renderEmotionStates();
        this.emitChange();
        this.refreshSummary();
    }

    private setEmotionKey(key: string): void {
        this.emotionKey = this.emotionKey === key ? null : key;
        this.renderEmotionStates();
        this.emitChange();
        this.refreshSummary();
    }

    private renderEmotionStates(): void {
        this.emotionStatesEl.empty();
        const group = EMOTION_GROUPS.find((item) => item.category === this.emotionCategory);
        if (!group) {
            this.emotionStatesEl.createDiv({
                cls: "fn-wellbeing-state-empty",
                text: "Choose Unpleasant, Neutral, or Pleasant to show emotion states.",
            });
            return;
        }

        const grid = this.emotionStatesEl.createDiv({ cls: "fn-wellbeing-state-grid" });
        for (const key of group.keys) {
            const mood = MOODS[key];
            if (!mood) continue;
            grid.appendChild(this.renderStateChip(mood));
        }
    }

    private renderStateChip(mood: MoodEntry): HTMLElement {
        const chip = createDiv({ cls: "fn-wellbeing-state-chip" });
        chip.toggleClass("selected", mood.key === this.emotionKey);
        chip.createSpan({ cls: "fn-wellbeing-state-emoji", text: mood.emoji });
        chip.createSpan({ cls: "fn-wellbeing-state-name", text: mood.name });
        chip.addEventListener("click", () => this.setEmotionKey(mood.key));
        return chip;
    }

    private refreshCategoryButtons(): void {
        for (const [category, btn] of this.categoryButtons) {
            btn.toggleClass("active", category === this.emotionCategory);
        }
    }

    private refreshSummary(): void {
        this.summaryEl.empty();
        const parts: string[] = [];
        const stress = getStressLevelLabel(this.stressLevel);
        const mood = this.emotionKey ? MOODS[this.emotionKey] : null;
        const category = getEmotionCategoryLabel(this.emotionCategory);
        if (stress) parts.push(`Stress: ${stress}`);
        if (mood) parts.push(`Emotion: ${mood.emoji} ${mood.name}`);
        else if (category) parts.push(`Emotion: ${category}`);

        if (parts.length === 0) {
            this.summaryEl.createSpan({
                cls: "fn-mood-summary-empty",
                text: "No wellbeing selected",
            });
            return;
        }

        const chip = this.summaryEl.createDiv({ cls: "fn-mood-summary-chip" });
        chip.createSpan({ cls: "fn-mood-summary-name", text: parts.join(" · ") });
        const clear = chip.createSpan({
            cls: "fn-mood-summary-clear",
            attr: { "aria-label": "Clear wellbeing" },
        });
        setIcon(clear, "x");
        clear.addEventListener("click", (evt) => {
            evt.stopPropagation();
            this.stressLevel = null;
            this.emotionCategory = null;
            this.emotionKey = null;
            this.refreshCategoryButtons();
            this.renderEmotionStates();
            this.emitChange();
            this.refreshSummary();
        });
    }

    private emitChange(): void {
        this.onChange({
            stressLevel: this.stressLevel,
            emotionCategory: this.emotionCategory,
            emotionKey: this.emotionKey,
        });
    }
}
