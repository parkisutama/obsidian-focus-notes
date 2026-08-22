import { AbstractInputSuggest, type App, type HoverPopover, Keymap } from "obsidian";
import {
    findInboxTrigger,
    type InboxTrigger,
    LIST_INDENT,
    leadingIndentLength,
    lineStartOffsets,
    suggestionSeparator,
} from "./InboxNotesText";
import {
    formatObjectReferencePart,
    type InboxRichTextPart,
    isInboxLineBreakInput,
    parseInboxRichText,
    parseContextRichText,
    serializeInboxRichText,
} from "./InboxRichText";
import type { ContextSuggestion } from "./InboxSuggestions";
import type { ScheduledItemMentionCandidate } from "./ScheduledItemMentionIndex.ts";
import { getCreatableObjectSources } from "./ObjectNote";
import { ObjectNoteModal } from "./ObjectNoteModal";
import { createObsidianLinkFormatter } from "./ObsidianLinkResolver.ts";
import { ObsidianInboxSuggestionSource } from "./ObsidianInboxSuggestionSource";
import { formatRelativeMarkdownLink } from "./InboxMarkdown.ts";
import type { ContextSourceSettings } from "./types";

type ContextNotesSuggestion =
    | { kind: "mention"; value: ContextSuggestion }
    | { kind: "mention-kind"; value: "task" | "event" }
    | { kind: "scheduled-item"; value: ScheduledItemMentionCandidate }
    | { kind: "tag"; value: string }
    | { kind: "create-object"; value: string };

export interface ContextNotesControllerOptions {
    initialValue: string;
    targetFile: string;
    getContextSources(): ContextSourceSettings[];
    onChange(value: string): void;
    referenceFormat?: "markdown-link" | "object-reference";
}

/** Rich contenteditable controller that persists portable Markdown, never editor HTML. */
export class ContextNotesController extends AbstractInputSuggest<ContextNotesSuggestion> {
    hoverPopover: HoverPopover | null = null;
    private activeTrigger: InboxTrigger | null = null;
    // The start offset of a trigger the user explicitly backed out of with Backspace.
    // getSuggestions() keeps refusing to reopen it until a genuinely new trigger
    // (a different start position — a freshly typed "@"/"#") appears.
    private suppressedTriggerStart: number | null = null;
    private targetFile: string;
    private readonly source: ObsidianInboxSuggestionSource;
    private readonly onScheduledItemsReady = (): void => this.requerySuggestions();
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
            return;
        }
        if (event.key === "Escape" && this.activeTrigger) {
            event.preventDefault();
            event.stopPropagation();
            this.suppressedTriggerStart = this.activeTrigger.start;
            this.activeTrigger = null;
            this.close();
            return;
        }
        // Backspacing while a suggestion is open is a "never mind" signal: close it
        // immediately rather than waiting for enough characters to be deleted to break
        // the trigger pattern. This is driven directly by our own keydown handler
        // rather than the suggester's own reactive re-querying, which isn't reliably
        // triggered by every contenteditable text mutation.
        if (event.key === "Backspace" && this.activeTrigger) {
            this.suppressedTriggerStart = this.activeTrigger.start;
            this.activeTrigger = null;
            this.close();
        }
        // Skip while a mention/tag suggestion is open so Tab keeps its normal meaning there.
        if (event.key === "Tab" && !this.activeTrigger) {
            event.preventDefault();
            if (event.shiftKey) this.outdentSelection();
            else this.indentSelection();
        }
    };

    constructor(
        app: App,
        private readonly inputEl: HTMLDivElement,
        private readonly options: ContextNotesControllerOptions,
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

    getSuggestions(): ContextNotesSuggestion[] {
        const text = this.readVisibleText();
        const cursor = getCaretOffset(this.inputEl);
        const trigger = findInboxTrigger(text, cursor);
        const suppressed = trigger !== null && trigger.start === this.suppressedTriggerStart;
        if (!suppressed) this.suppressedTriggerStart = null;

        this.activeTrigger = suppressed ? null : trigger;
        if (!this.activeTrigger) {
            // Also close proactively here (not just from the Backspace handler) so any
            // other way the trigger stops being valid — moving the cursor away, pasting
            // over it — drops a stale suggestion just as reliably.
            this.close();
            return [];
        }

        if (this.activeTrigger.kind === "mention") {
            const sources = this.options.getContextSources();
            const matches = this.source
                .getContextSuggestions(this.activeTrigger.query, sources, this.limit)
                .map((value) => ({ kind: "mention" as const, value }));
            const query = this.activeTrigger.query.trim();
            if (!query) {
                return [
                    { kind: "mention-kind", value: "task" },
                    { kind: "mention-kind", value: "event" },
                    ...matches.slice(0, Math.max(0, this.limit - 2)),
                ];
            }
            if (getCreatableObjectSources(sources).length === 0) return matches;
            return [...matches.slice(0, Math.max(0, this.limit - 1)), { kind: "create-object", value: query }];
        }
        if (this.activeTrigger.kind === "scheduled-item" && this.activeTrigger.itemKind) {
            return this.source
                .getScheduledItemSuggestions(
                    this.activeTrigger.itemKind,
                    this.activeTrigger.query,
                    this.limit,
                    this.onScheduledItemsReady,
                )
                .map((value) => ({ kind: "scheduled-item" as const, value }));
        }
        return this.source
            .getTagSuggestions(this.activeTrigger.query, this.limit)
            .map((value) => ({ kind: "tag" as const, value }));
    }

    renderSuggestion(suggestion: ContextNotesSuggestion, el: HTMLElement): void {
        if (suggestion.kind === "tag") {
            el.setText(suggestion.value);
            return;
        }
        if (suggestion.kind === "create-object") {
            el.createDiv({ text: `Create “${suggestion.value}”…`, cls: "fn-inbox-suggestion-label" });
            el.createDiv({ text: "New Object Note from a configured template", cls: "fn-inbox-suggestion-context" });
            return;
        }
        if (suggestion.kind === "mention-kind") {
            el.createDiv({ text: suggestion.value === "task" ? "Task" : "Event", cls: "fn-inbox-suggestion-label" });
            el.createDiv({ text: "Link an existing scheduled item", cls: "fn-inbox-suggestion-context" });
            return;
        }
        if (suggestion.kind === "scheduled-item") {
            el.createDiv({ text: suggestion.value.title, cls: "fn-inbox-suggestion-label" });
            el.createDiv({
                text: `${suggestion.value.kind === "task" ? "Task" : "Event"} · ${suggestion.value.status} · ${suggestion.value.filePath}`,
                cls: "fn-inbox-suggestion-context",
            });
            return;
        }
        const { value } = suggestion;
        el.createDiv({ text: value.label, cls: "fn-inbox-suggestion-label" });
        el.createDiv({
            text: `${value.sourceName} · ${value.filePath}`,
            cls: "fn-inbox-suggestion-context",
        });
    }

    selectSuggestion(suggestion: ContextNotesSuggestion): void {
        const trigger = this.activeTrigger;
        if (!trigger) return;
        if (suggestion.kind === "mention-kind") {
            const replacement = this.inputEl.ownerDocument.createTextNode(`@${suggestion.value} `);
            replaceVisibleRange(this.inputEl, trigger.start, trigger.end, replacement);
            placeCaretAtEnd(replacement);
            this.activeTrigger = null;
            this.emitMarkdown();
            this.requerySuggestions();
            return;
        }
        if (suggestion.kind === "create-object") {
            this.close();
            new ObjectNoteModal(this.app, this.options.getContextSources(), suggestion.value, (file, label) =>
                this.replaceTriggerWithLink(trigger, file.path, label),
            ).open();
            return;
        }
        const separator = suggestionSeparator(this.readVisibleText(), trigger.end);
        const replacement =
            suggestion.kind === "tag"
                ? this.inputEl.ownerDocument.createTextNode(suggestion.value)
                : suggestion.kind === "scheduled-item"
                  ? this.createLink(suggestion.value.filePath, suggestion.value.title, `#^${suggestion.value.blockId}`)
                  : this.createLink(suggestion.value.filePath, suggestion.value.label);

        replaceVisibleRange(this.inputEl, trigger.start, trigger.end, replacement);
        const cursorNode = this.inputEl.ownerDocument.createTextNode(separator);
        replacement.parentNode?.insertBefore(cursorNode, replacement.nextSibling);
        placeCaretAtEnd(cursorNode);
        this.emitMarkdown();
        this.activeTrigger = null;
        this.close();
    }

    private replaceTriggerWithLink(trigger: InboxTrigger, filePath: string, label: string): void {
        const separator = suggestionSeparator(this.readVisibleText(), trigger.end);
        const replacement = this.createLink(filePath, label);
        replaceVisibleRange(this.inputEl, trigger.start, trigger.end, replacement);
        const cursorNode = this.inputEl.ownerDocument.createTextNode(separator);
        replacement.parentNode?.insertBefore(cursorNode, replacement.nextSibling);
        placeCaretAtEnd(cursorNode);
        this.emitMarkdown();
        this.activeTrigger = null;
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
        const resolveDestination = (destination: string): string | null => {
            const decoded = safeDecodeURIComponent(destination);
            return this.app.metadataCache.getFirstLinkpathDest(decoded, this.targetFile)?.path ?? null;
        };
        const parts =
            this.options.referenceFormat === "object-reference"
                ? parseContextRichText(markdown, resolveDestination)
                : parseInboxRichText(markdown, resolveDestination);
        this.inputEl.empty();
        for (const part of parts) {
            this.inputEl.appendChild(
                part.kind === "text"
                    ? this.inputEl.ownerDocument.createTextNode(part.value)
                    : this.createLink(part.filePath, part.label, part.subpath),
            );
        }
    }

    private createLink(filePath: string, label: string, subpath?: string): HTMLAnchorElement {
        const link = this.inputEl.ownerDocument.createElement("a");
        link.addClass("internal-link", "fn-inbox-inline-link");
        link.dataset.href = filePath;
        link.dataset.inboxFilePath = filePath;
        if (subpath) link.dataset.inboxSubpath = subpath;
        link.href = `${filePath}${subpath ?? ""}`;
        link.textContent = label;
        link.contentEditable = "false";
        link.tabIndex = 0;
        link.setAttribute("role", "link");
        return link;
    }

    private emitMarkdown(): void {
        const formatter = (targetFile: string, filePath: string, label: string, subpath?: string): string =>
            subpath || this.options.referenceFormat !== "object-reference"
                ? this.formatRichLink(targetFile, filePath, label, subpath)
                : formatObjectReferencePart(targetFile, filePath, label);
        this.options.onChange(serializeInboxRichText(readDomParts(this.inputEl), this.targetFile, formatter));
    }

    /**
     * Formats a link the way Obsidian itself would (honoring the user's configured link
     * format and Wikilinks setting) instead of always writing a relative Markdown link,
     * falling back to one if the target can't be resolved to a file anymore.
     */
    private readonly formatObsidianLink = createObsidianLinkFormatter(this.app);

    private readonly formatRichLink = (
        targetFile: string,
        filePath: string,
        label: string,
        subpath?: string,
    ): string => {
        if (!subpath) return this.formatObsidianLink(targetFile, filePath, label);
        return formatRelativeMarkdownLink(targetFile, filePath, label).replace(/\)$/, `${subpath})`);
    };

    private requerySuggestions(): void {
        queueMicrotask(() => this.inputEl.dispatchEvent(new Event("input", { bubbles: true })));
    }

    private readVisibleText(): string {
        return this.inputEl.innerText.replace(/\u00a0/g, " ").replace(/\r\n/g, "\n");
    }

    /**
     * Indents every line touched by the selection by one level (4 spaces), matching the
     * indent the Task block editor writes to disk, so nested list lines typed here land
     * at the same depth they'll have in the Markdown file.
     */
    private indentSelection(): void {
        const { start, end } = getSelectionOffsets(this.inputEl);
        const text = this.readVisibleText();
        const starts = lineStartOffsets(text, start, end);
        let inserted = 0;
        for (const lineStart of starts) {
            replaceVisibleRange(
                this.inputEl,
                lineStart + inserted,
                lineStart + inserted,
                this.inputEl.ownerDocument.createTextNode(LIST_INDENT),
            );
            inserted += LIST_INDENT.length;
        }
        setSelectionOffsets(this.inputEl, start + LIST_INDENT.length, end + inserted);
        this.emitMarkdown();
    }

    private outdentSelection(): void {
        const { start, end } = getSelectionOffsets(this.inputEl);
        const text = this.readVisibleText();
        const starts = lineStartOffsets(text, start, end);
        let removedBeforeStart = 0;
        let removedTotal = 0;
        starts.forEach((lineStart, index) => {
            const removable = leadingIndentLength(text, lineStart);
            if (removable === 0) return;
            const liveStart = lineStart - removedTotal;
            const range = this.inputEl.ownerDocument.createRange();
            const startPoint = pointAtOffset(this.inputEl, liveStart);
            const endPoint = pointAtOffset(this.inputEl, liveStart + removable);
            range.setStart(startPoint.node, startPoint.offset);
            range.setEnd(endPoint.node, endPoint.offset);
            range.deleteContents();
            if (index === 0) removedBeforeStart = Math.min(removable, start - lineStart);
            removedTotal += removable;
        });
        const newStart = Math.max(0, start - removedBeforeStart);
        setSelectionOffsets(this.inputEl, newStart, Math.max(newStart, end - removedTotal));
        this.emitMarkdown();
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
            `${link.dataset.inboxFilePath ?? ""}${link.dataset.inboxSubpath ?? ""}`,
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
            linktext: `${filePath}${link.dataset.inboxSubpath ?? ""}`,
            sourcePath: this.targetFile,
        });
    }
}

export { ContextNotesController as InboxNotesController };

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
            parts.push({
                kind: "link",
                label: node.textContent ?? filePath,
                filePath,
                ...(node.dataset.inboxSubpath ? { subpath: node.dataset.inboxSubpath } : {}),
            });
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

function getSelectionOffsets(root: HTMLElement): { start: number; end: number } {
    const selection = root.ownerDocument.getSelection();
    if (!selection?.rangeCount) {
        const end = root.innerText.length;
        return { start: end, end };
    }
    const range = selection.getRangeAt(0);
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
        const end = root.innerText.length;
        return { start: end, end };
    }
    const offsetOf = (container: Node, offset: number): number => {
        const prefix = root.ownerDocument.createRange();
        prefix.selectNodeContents(root);
        prefix.setEnd(container, offset);
        return prefix.toString().length;
    };
    return {
        start: offsetOf(range.startContainer, range.startOffset),
        end: offsetOf(range.endContainer, range.endOffset),
    };
}

function setSelectionOffsets(root: HTMLElement, start: number, end: number): void {
    const document = root.ownerDocument;
    const startPoint = pointAtOffset(root, start);
    const endPoint = pointAtOffset(root, end);
    const range = document.createRange();
    range.setStart(startPoint.node, startPoint.offset);
    range.setEnd(endPoint.node, endPoint.offset);
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
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

function placeCaretAtEnd(node: Node): void {
    const document = node.ownerDocument;
    if (!document) return;
    const range = document.createRange();
    range.setStart(node, node.textContent?.length ?? 0);
    range.collapse(true);
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    (node.parentElement as HTMLElement | null)?.focus();
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
