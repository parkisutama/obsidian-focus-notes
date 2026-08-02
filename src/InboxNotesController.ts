import { AbstractInputSuggest, type App, type HoverPopover, Keymap } from "obsidian";
import { findInboxTrigger, type InboxTrigger } from "./InboxNotesText";
import {
    type InboxRichTextPart,
    isInboxLineBreakInput,
    parseInboxRichText,
    serializeInboxRichText,
} from "./InboxRichText";
import type { MentionSuggestion } from "./InboxSuggestions";
import { ObsidianInboxSuggestionSource } from "./ObsidianInboxSuggestionSource";
import { formatRelativeMarkdownLink } from "./InboxMarkdown";

type InboxNotesSuggestion = { kind: "mention"; value: MentionSuggestion } | { kind: "tag"; value: string };

export interface InboxNotesControllerOptions {
    initialValue: string;
    targetFile: string;
    getPeopleFolders(): string[];
    getPlaceFolders(): string[];
    onChange(value: string): void;
}

/** Rich contenteditable controller that persists portable Markdown, never editor HTML. */
export class InboxNotesController extends AbstractInputSuggest<InboxNotesSuggestion> {
    hoverPopover: HoverPopover | null = null;
    private activeTrigger: InboxTrigger | null = null;
    private targetFile: string;
    private readonly source: ObsidianInboxSuggestionSource;
    private readonly onInput = (): void => this.emitMarkdown();
    private readonly onBeforeInput = (event: InputEvent): void => {
        if (!isInboxLineBreakInput(event.inputType)) return;
        event.preventDefault();
        insertAtSelection(this.inputEl, this.inputEl.ownerDocument.createTextNode("\n"));
        this.emitMarkdown();
    };
    private readonly onPaste = (event: ClipboardEvent): void => this.pastePlainText(event);
    private readonly onClick = (event: MouseEvent): void => this.openInternalLink(event);
    private readonly onMouseOver = (event: MouseEvent): void => this.previewInternalLink(event);
    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (event.key === "Enter" && event.target instanceof HTMLAnchorElement) {
            this.openInternalLink(event);
        }
    };

    constructor(
        app: App,
        private readonly inputEl: HTMLDivElement,
        private readonly options: InboxNotesControllerOptions,
    ) {
        super(app, inputEl);
        this.source = new ObsidianInboxSuggestionSource(app);
        this.targetFile = options.targetFile;
        this.limit = 20;
        inputEl.contentEditable = "true";
        inputEl.setAttribute("role", "textbox");
        inputEl.setAttribute("aria-multiline", "true");
        this.renderInitialValue(options.initialValue);
        inputEl.addEventListener("input", this.onInput);
        inputEl.addEventListener("beforeinput", this.onBeforeInput);
        inputEl.addEventListener("paste", this.onPaste);
        inputEl.addEventListener("click", this.onClick);
        inputEl.addEventListener("mouseover", this.onMouseOver);
        inputEl.addEventListener("keydown", this.onKeyDown);
    }

    getSuggestions(): InboxNotesSuggestion[] {
        const text = this.readVisibleText();
        const cursor = getCaretOffset(this.inputEl);
        this.activeTrigger = findInboxTrigger(text, cursor);
        if (!this.activeTrigger) return [];

        if (this.activeTrigger.kind === "mention") {
            return this.source
                .getMentionSuggestions(
                    this.activeTrigger.query,
                    this.options.getPeopleFolders(),
                    this.options.getPlaceFolders(),
                    this.limit,
                )
                .map((value) => ({ kind: "mention" as const, value }));
        }
        return this.source
            .getTagSuggestions(this.activeTrigger.query, this.limit)
            .map((value) => ({ kind: "tag" as const, value }));
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
            cls: "fn-inbox-suggestion-context",
        });
    }

    selectSuggestion(suggestion: InboxNotesSuggestion): void {
        const trigger = this.activeTrigger;
        if (!trigger) return;
        const replacement =
            suggestion.kind === "tag"
                ? this.inputEl.ownerDocument.createTextNode(suggestion.value)
                : this.createLink(suggestion.value.filePath, suggestion.value.label);

        replaceVisibleRange(this.inputEl, trigger.start, trigger.end, replacement);
        placeCaretAfter(replacement);
        this.emitMarkdown();
        this.activeTrigger = null;
        this.close();
    }

    setTargetFile(nextTargetFile: string): void {
        const next = nextTargetFile.trim();
        if (!next || next === this.targetFile) return;
        this.targetFile = next;
        this.emitMarkdown();
    }

    destroy(): void {
        this.inputEl.removeEventListener("input", this.onInput);
        this.inputEl.removeEventListener("beforeinput", this.onBeforeInput);
        this.inputEl.removeEventListener("paste", this.onPaste);
        this.inputEl.removeEventListener("click", this.onClick);
        this.inputEl.removeEventListener("mouseover", this.onMouseOver);
        this.inputEl.removeEventListener("keydown", this.onKeyDown);
        this.source.destroy();
        this.close();
    }

    private renderInitialValue(markdown: string): void {
        const parts = parseInboxRichText(markdown, (destination) => {
            const decoded = safeDecodeURIComponent(destination);
            return this.app.metadataCache.getFirstLinkpathDest(decoded, this.targetFile)?.path ?? null;
        });
        this.inputEl.empty();
        for (const part of parts) {
            this.inputEl.appendChild(
                part.kind === "text"
                    ? this.inputEl.ownerDocument.createTextNode(part.value)
                    : this.createLink(part.filePath, part.label),
            );
        }
    }

    private createLink(filePath: string, label: string): HTMLAnchorElement {
        const link = this.inputEl.ownerDocument.createElement("a");
        link.addClass("internal-link", "fn-inbox-inline-link");
        link.dataset.href = filePath;
        link.dataset.inboxFilePath = filePath;
        link.href = filePath;
        link.textContent = label;
        link.contentEditable = "false";
        link.tabIndex = 0;
        link.setAttribute("role", "link");
        return link;
    }

    private emitMarkdown(): void {
        this.options.onChange(
            serializeInboxRichText(readDomParts(this.inputEl), this.targetFile, formatRelativeMarkdownLink),
        );
    }

    private readVisibleText(): string {
        return this.inputEl.innerText.replace(/\u00a0/g, " ").replace(/\r\n/g, "\n");
    }

    private pastePlainText(event: ClipboardEvent): void {
        const text = event.clipboardData?.getData("text/plain");
        if (text === undefined) return;
        event.preventDefault();
        insertAtSelection(this.inputEl, this.inputEl.ownerDocument.createTextNode(text));
        this.emitMarkdown();
    }

    private openInternalLink(event: MouseEvent | KeyboardEvent): void {
        const link = closestInboxLink(event.target);
        if (!link) return;
        event.preventDefault();
        void this.app.workspace.openLinkText(
            link.dataset.inboxFilePath ?? "",
            this.targetFile,
            Keymap.isModEvent(event),
        );
    }

    private previewInternalLink(event: MouseEvent): void {
        const link = closestInboxLink(event.target);
        const filePath = link?.dataset.inboxFilePath;
        if (!link || !filePath) return;
        this.app.workspace.trigger("hover-link", {
            event,
            source: "focus-notes-inbox",
            hoverParent: this,
            targetEl: link,
            linktext: filePath,
            sourcePath: this.targetFile,
        });
    }
}

function readDomParts(root: HTMLElement): InboxRichTextPart[] {
    const parts: InboxRichTextPart[] = [];
    const visit = (node: Node): void => {
        if (node.nodeType === Node.TEXT_NODE) {
            parts.push({ kind: "text", value: node.textContent ?? "" });
            return;
        }
        if (!(node instanceof HTMLElement)) return;
        const filePath = node.dataset.inboxFilePath;
        if (node instanceof HTMLAnchorElement && filePath) {
            parts.push({ kind: "link", label: node.textContent ?? filePath, filePath });
            return;
        }
        if (node instanceof HTMLBRElement) {
            parts.push({ kind: "text", value: "\n" });
            return;
        }
        node.childNodes.forEach(visit);
        if ((node instanceof HTMLDivElement || node instanceof HTMLParagraphElement) && node.nextSibling) {
            parts.push({ kind: "text", value: "\n" });
        }
    };
    root.childNodes.forEach(visit);
    return parts;
}

function closestInboxLink(target: EventTarget | null): HTMLAnchorElement | null {
    return target instanceof Element ? target.closest<HTMLAnchorElement>("a[data-inbox-file-path]") : null;
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

function replaceVisibleRange(root: HTMLElement, start: number, end: number, replacement: Node): void {
    const startPoint = pointAtOffset(root, start);
    const endPoint = pointAtOffset(root, end);
    const range = root.ownerDocument.createRange();
    range.setStart(startPoint.node, startPoint.offset);
    range.setEnd(endPoint.node, endPoint.offset);
    range.deleteContents();
    range.insertNode(replacement);
}

function pointAtOffset(root: HTMLElement, offset: number): { node: Node; offset: number } {
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let remaining = Math.max(0, offset);
    let node = walker.nextNode();
    while (node) {
        const length = node.textContent?.length ?? 0;
        if (remaining <= length) return { node, offset: remaining };
        remaining -= length;
        node = walker.nextNode();
    }
    return { node: root, offset: root.childNodes.length };
}

function placeCaretAfter(node: Node): void {
    const document = node.ownerDocument;
    if (!document) return;
    const range = document.createRange();
    range.setStartAfter(node);
    range.collapse(true);
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    (node.parentElement as HTMLElement | null)?.focus();
}

function insertAtSelection(root: HTMLElement, node: Node): void {
    const selection = root.ownerDocument.getSelection();
    if (!selection?.rangeCount || !root.contains(selection.anchorNode)) {
        root.appendChild(node);
        placeCaretAfter(node);
        return;
    }
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(node);
    placeCaretAfter(node);
}

function safeDecodeURIComponent(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}
