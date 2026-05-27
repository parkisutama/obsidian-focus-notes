import { setIcon } from "obsidian";
import {
    BODY_REGIONS,
    BodyRegion,
    MOODS,
    MoodEntry,
    QUADRANTS,
    Quadrant,
    SensationRow,
    moodsInQuadrant
} from "./MoodReference";

/**
 * Mood selection component used inside LogModal.
 *
 * Two entry modes user can switch between via tabs at the top:
 *   1. "By feeling"  — quadrant → mood. Familiar, fast for users who can
 *                      already name what they feel.
 *   2. "By body"     — region → sensation → (disambiguation) → mood. For
 *                      pre-verbal states, where the body knows before the
 *                      mind does. Disambiguation lifts one of three meta-
 *                      questions (valence / direction / attention) from the
 *                      reference and surfaces it above the candidate cards
 *                      when the candidates split cleanly along that axis.
 *
 * The two flows always converge on the same MoodEntry, so downstream code
 * (template tokens, recent feed) doesn't care which path produced it.
 */
export class MoodPicker {
    private container: HTMLElement;
    private selectedKey: string | null = null;

    private bodyEl!: HTMLElement;
    private summaryEl!: HTMLElement;
    private modeTabs!: { feeling: HTMLElement; body: HTMLElement };

    /** Current entry mode for this picker instance. */
    private entryMode: "feeling" | "body" = "feeling";

    constructor(parent: HTMLElement, private onChange: (key: string | null) => void) {
        this.container = parent.createDiv({ cls: "fn-mood-picker" });
        this.renderModeTabs();
        this.bodyEl = this.container.createDiv({ cls: "fn-mood-body" });
        this.summaryEl = this.container.createDiv({ cls: "fn-mood-summary" });
        this.applyEntryMode();
        this.refreshSummary();
    }

    public getSelectedKey(): string | null {
        return this.selectedKey;
    }

    public setSelectedKey(key: string | null): void {
        this.selectedKey = key && MOODS[key] ? key : null;
        this.refreshSummary();
        this.onChange(this.selectedKey);
    }

    // -----------------------------------------------------------------------
    // Mode tabs
    // -----------------------------------------------------------------------

    private renderModeTabs(): void {
        const row = this.container.createDiv({ cls: "fn-mood-mode-row" });
        const make = (label: string, mode: "feeling" | "body"): HTMLElement => {
            const btn = row.createEl("button", { cls: "fn-mood-mode-tab", text: label });
            btn.addEventListener("click", () => {
                this.entryMode = mode;
                this.applyEntryMode();
            });
            return btn;
        };
        this.modeTabs = {
            feeling: make("By feeling", "feeling"),
            body: make("By body", "body")
        };
    }

    private applyEntryMode(): void {
        this.modeTabs.feeling.toggleClass("active", this.entryMode === "feeling");
        this.modeTabs.body.toggleClass("active", this.entryMode === "body");
        this.bodyEl.empty();
        if (this.entryMode === "feeling") {
            this.renderFeelingFlow();
        } else {
            this.renderBodyFlow();
        }
    }

    // -----------------------------------------------------------------------
    // By-feeling flow
    // -----------------------------------------------------------------------

    private renderFeelingFlow(): void {
        // Initial view: 4 quadrant cards. Click → render that quadrant's moods.
        const grid = this.bodyEl.createDiv({ cls: "fn-quadrant-grid" });
        for (const q of QUADRANTS) {
            const card = grid.createDiv({ cls: "fn-quadrant-card" });
            card.createDiv({ cls: "fn-quadrant-axis", text: q.axisLabel });
            card.createDiv({ cls: "fn-quadrant-name", text: q.name });
            card.createDiv({ cls: "fn-quadrant-desc", text: q.description });
            card.addEventListener("click", () => this.renderQuadrantMoods(q.key));
        }
    }

    private renderQuadrantMoods(quadrant: Quadrant): void {
        this.bodyEl.empty();
        const back = this.bodyEl.createEl("button", {
            cls: "fn-mood-back",
            text: "← Back to quadrants"
        });
        back.addEventListener("click", () => this.applyEntryMode());

        const moods = moodsInQuadrant(quadrant);
        const grid = this.bodyEl.createDiv({ cls: "fn-mood-grid" });
        for (const mood of moods) {
            grid.appendChild(this.renderMoodCard(mood));
        }
    }

    // -----------------------------------------------------------------------
    // By-body flow
    // -----------------------------------------------------------------------

    private renderBodyFlow(): void {
        const grid = this.bodyEl.createDiv({ cls: "fn-region-grid" });
        for (const region of BODY_REGIONS) {
            const card = grid.createDiv({ cls: "fn-region-card" });
            card.createDiv({ cls: "fn-region-emoji", text: region.emoji });
            card.createDiv({ cls: "fn-region-name", text: region.name });
            card.addEventListener("click", () => this.renderSensations(region));
        }
    }

    private renderSensations(region: BodyRegion): void {
        this.bodyEl.empty();
        const back = this.bodyEl.createEl("button", {
            cls: "fn-mood-back",
            text: "← Back to body regions"
        });
        back.addEventListener("click", () => this.applyEntryMode());

        const heading = this.bodyEl.createDiv({ cls: "fn-mood-step-heading" });
        heading.createSpan({ text: `${region.emoji} ${region.name}`, cls: "fn-mood-step-title" });
        heading.createSpan({
            text: "What does the sensation feel like?",
            cls: "fn-mood-step-subtitle"
        });

        const list = this.bodyEl.createDiv({ cls: "fn-sensation-list" });
        for (const row of region.sensations) {
            const item = list.createDiv({ cls: "fn-sensation-row" });
            item.createSpan({ text: row.sensation, cls: "fn-sensation-text" });
            const arrow = item.createSpan({ cls: "fn-sensation-arrow" });
            setIcon(arrow, "chevron-right");
            item.addEventListener("click", () => this.renderCandidates(region, row));
        }
    }

    private renderCandidates(region: BodyRegion, row: SensationRow): void {
        this.bodyEl.empty();
        const back = this.bodyEl.createEl("button", {
            cls: "fn-mood-back",
            text: `← Back to ${region.name.toLowerCase()} sensations`
        });
        back.addEventListener("click", () => this.renderSensations(region));

        const heading = this.bodyEl.createDiv({ cls: "fn-mood-step-heading" });
        heading.createSpan({
            text: `${region.emoji} ${row.sensation}`,
            cls: "fn-mood-step-title"
        });

        // Disambiguation prompt — when present, render the question and split
        // candidates into left/right buckets the user can collapse independently.
        // When absent (synonym-rich rows), just show all candidates as cards
        // and let the user pick by definition.
        const renderCard = (mood: MoodEntry, into: HTMLElement): void => {
            into.appendChild(this.renderMoodCard(mood));
        };

        if (row.disambiguation && row.disambiguation.leftKeys && row.disambiguation.rightKeys) {
            const promptEl = this.bodyEl.createDiv({ cls: "fn-mood-question" });
            promptEl.createDiv({ text: "Ask yourself:", cls: "fn-mood-question-label" });
            promptEl.createDiv({ text: row.disambiguation.prompt, cls: "fn-mood-question-text" });

            const split = this.bodyEl.createDiv({ cls: "fn-mood-split" });
            const leftCol = split.createDiv({ cls: "fn-mood-split-col" });
            leftCol.createDiv({
                cls: "fn-mood-split-label",
                text: row.disambiguation.leftLabel ?? "Option A"
            });
            const leftGrid = leftCol.createDiv({ cls: "fn-mood-grid" });
            for (const key of row.disambiguation.leftKeys) {
                const m = MOODS[key];
                if (m) renderCard(m, leftGrid);
            }

            const rightCol = split.createDiv({ cls: "fn-mood-split-col" });
            rightCol.createDiv({
                cls: "fn-mood-split-label",
                text: row.disambiguation.rightLabel ?? "Option B"
            });
            const rightGrid = rightCol.createDiv({ cls: "fn-mood-grid" });
            for (const key of row.disambiguation.rightKeys) {
                const m = MOODS[key];
                if (m) renderCard(m, rightGrid);
            }
        } else {
            // No clean split — render all candidates as a single grid.
            // Optional intro nudges the user to read definitions before picking.
            this.bodyEl.createDiv({
                cls: "fn-mood-question-text fn-mood-no-split",
                text: "These overlap — read the definitions and pick what resonates."
            });
            const grid = this.bodyEl.createDiv({ cls: "fn-mood-grid" });
            for (const key of row.candidateKeys) {
                const m = MOODS[key];
                if (m) renderCard(m, grid);
            }
        }
    }

    // -----------------------------------------------------------------------
    // Mood card — shared by all flows
    // -----------------------------------------------------------------------

    private renderMoodCard(mood: MoodEntry): HTMLElement {
        const card = createDiv({ cls: "fn-mood-card" });
        card.toggleClass("selected", mood.key === this.selectedKey);

        const head = card.createDiv({ cls: "fn-mood-card-head" });
        head.createSpan({ text: mood.emoji, cls: "fn-mood-card-emoji" });
        head.createSpan({ text: mood.name, cls: "fn-mood-card-name" });

        card.createDiv({ cls: "fn-mood-card-def", text: mood.definition });

        // Quick action sits in a less prominent row — visible without hover so
        // mobile users don't lose it, but visually deemphasised.
        const action = card.createDiv({ cls: "fn-mood-card-action" });
        action.createSpan({ text: "Quick action: ", cls: "fn-mood-card-action-label" });
        action.appendText(mood.quickAction);

        card.addEventListener("click", () => {
            this.setSelectedKey(mood.key);
            // Visually re-render to show selection.
            // Cheap full-grid re-paint via active flow.
            this.applyEntryMode();
        });
        return card;
    }

    // -----------------------------------------------------------------------
    // Summary row at the bottom — always visible so the user knows what's
    // currently selected, regardless of which flow they're in.
    // -----------------------------------------------------------------------

    private refreshSummary(): void {
        this.summaryEl.empty();
        if (!this.selectedKey) {
            this.summaryEl.createSpan({
                cls: "fn-mood-summary-empty",
                text: "No mood selected"
            });
            return;
        }
        const mood = MOODS[this.selectedKey];
        if (!mood) return;
        const chip = this.summaryEl.createDiv({ cls: "fn-mood-summary-chip" });
        chip.createSpan({ text: mood.emoji, cls: "fn-mood-summary-emoji" });
        chip.createSpan({ text: mood.name, cls: "fn-mood-summary-name" });
        const clear = chip.createSpan({ cls: "fn-mood-summary-clear", attr: { "aria-label": "Clear mood" } });
        setIcon(clear, "x");
        clear.addEventListener("click", evt => {
            evt.stopPropagation();
            this.setSelectedKey(null);
            // Re-render whatever flow the user is in to reflect the cleared selection.
            this.applyEntryMode();
        });
    }
}
