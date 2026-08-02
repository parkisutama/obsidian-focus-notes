import { AbstractInputSuggest, App } from "obsidian";
import { formatRelativeMarkdownLink } from "./InboxMarkdown";
import {
    findInboxTrigger,
    InboxTrigger,
    rebaseTrackedMentionLinks,
    replaceInboxTextRange,
    TrackedMentionLink
} from "./InboxNotesText";
import type { MentionSuggestion } from "./InboxSuggestions";
import { ObsidianInboxSuggestionSource } from "./ObsidianInboxSuggestionSource";

type InboxNotesSuggestion =
    | { kind: "mention"; value: MentionSuggestion }
    | { kind: "tag"; value: string };

export interface InboxNotesControllerOptions {
    initialValue: string;
    targetFile: string;
    getPeopleFolders(): string[];
    getPlaceFolders(): string[];
    onChange(value: string): void;
}

/** Inline @mention and #tag suggestions for a plaintext contenteditable body. */
export class InboxNotesController extends AbstractInputSuggest<InboxNotesSuggestion> {
    private activeTrigger: InboxTrigger | null = null;
    private trackedMentions: TrackedMentionLink[] = [];
    private targetFile: string;
    private readonly source: ObsidianInboxSuggestionSource;
    private readonly onInput = (): void => this.options.onChange(this.readText());

    constructor(
        app: App,
        private readonly inputEl: HTMLDivElement,
        private readonly options: InboxNotesControllerOptions
    ) {
        super(app, inputEl);
        this.source = new ObsidianInboxSuggestionSource(app);
        this.targetFile = options.targetFile;
        this.limit = 20;
        inputEl.contentEditable = "plaintext-only";
        inputEl.setAttribute("role", "textbox");
        inputEl.setAttribute("aria-multiline", "true");
        inputEl.textContent = options.initialValue;
        inputEl.addEventListener("input", this.onInput);
    }

    getSuggestions(): InboxNotesSuggestion[] {
        const text = this.readText();
        const cursor = getCaretOffset(this.inputEl);
        this.activeTrigger = findInboxTrigger(text, cursor);
        if (!this.activeTrigger) return [];

        if (this.activeTrigger.kind === "mention") {
            return this.source.getMentionSuggestions(
                this.activeTrigger.query,
                this.options.getPeopleFolders(),
                this.options.getPlaceFolders(),
                this.limit
            ).map(value => ({ kind: "mention" as const, value }));
        }
        return this.source.getTagSuggestions(this.activeTrigger.query, this.limit)
            .map(value => ({ kind: "tag" as const, value }));
    }

    renderSuggestion(suggestion: InboxNotesSuggestion, el: HTMLElement): void {
        if (suggestion.kind === "tag") {
            el.setText(suggestion.value);
            return;
        }
        const { value } = suggestion;
        el.createDiv({ text: value.label, cls: "fn-inbox-suggestion-label" });
        el.createDiv({
            text: `${value.kind === "person" ? "People" : "Place"} · ${value.filePath}`,
            cls: "fn-inbox-suggestion-context"
        });
    }

    selectSuggestion(suggestion: InboxNotesSuggestion): void {
        const trigger = this.activeTrigger;
        if (!trigger) return;
        const current = this.readText();
        let replacement: string;

        if (suggestion.kind === "tag") {
            replacement = suggestion.value;
        } else {
            replacement = formatRelativeMarkdownLink(
                this.targetFile,
                suggestion.value.filePath,
                suggestion.value.label
            );
            this.trackedMentions.push({
                filePath: suggestion.value.filePath,
                label: suggestion.value.label,
                markdown: replacement
            });
        }

        const next = replaceInboxTextRange(current, trigger, replacement);
        this.writeText(next, trigger.start + replacement.length);
        this.activeTrigger = null;
        this.close();
    }

    setTargetFile(nextTargetFile: string): void {
        const next = nextTargetFile.trim();
        if (!next || next === this.targetFile) return;
        const rebased = rebaseTrackedMentionLinks(
            this.readText(),
            this.trackedMentions,
            this.targetFile,
            next,
            formatRelativeMarkdownLink
        );
        this.targetFile = next;
        this.trackedMentions = rebased.mentions;
        this.writeText(rebased.text, rebased.text.length, false);
    }

    destroy(): void {
        this.inputEl.removeEventListener("input", this.onInput);
        this.close();
    }

    private readText(): string {
        return this.inputEl.innerText.replace(/\u00a0/g, " ").replace(/\r\n/g, "\n");
    }

    private writeText(value: string, caret: number, restoreCaret = true): void {
        this.inputEl.textContent = value;
        this.options.onChange(value);
        if (restoreCaret) setCaretOffset(this.inputEl, caret);
    }
}

function getCaretOffset(root: HTMLElement): number {
    const selection = root.ownerDocument.getSelection();
    if (!selection?.rangeCount) return root.innerText.length;
    const range = selection.getRangeAt(0);
    if (!root.contains(range.endContainer)) return root.innerText.length;
    const prefix = range.cloneRange();
    prefix.selectNodeContents(root);
    prefix.setEnd(range.endContainer, range.endOffset);
    return prefix.toString().length;
}

function setCaretOffset(root: HTMLElement, offset: number): void {
    root.focus();
    const document = root.ownerDocument;
    const showText = document.defaultView?.NodeFilter.SHOW_TEXT ?? 4;
    const walker = document.createTreeWalker(root, showText);
    let remaining = Math.max(0, offset);
    let node = walker.nextNode();
    while (node) {
        const length = node.textContent?.length ?? 0;
        if (remaining <= length) {
            const range = document.createRange();
            range.setStart(node, remaining);
            range.collapse(true);
            const selection = document.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(range);
            return;
        }
        remaining -= length;
        node = walker.nextNode();
    }
}
