import type { InboxRichTextPart } from "../domain/InboxRichText.ts";

export function readDomParts(root: HTMLElement): InboxRichTextPart[] {
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
            parts.push({ kind: "text", value: "\n" });
        }
    };
    root.childNodes.forEach(visit);
    return parts;
}

export function closestInboxLink(target: EventTarget | null): HTMLAnchorElement | null {
    return target instanceof Element ? target.closest<HTMLAnchorElement>("a[data-inbox-file-path]") : null;
}

export function getCaretOffset(root: HTMLElement): number {
    const selection = root.ownerDocument.getSelection();
    if (!selection?.rangeCount) return root.innerText.length;
    const range = selection.getRangeAt(0);
    if (!root.contains(range.endContainer)) return root.innerText.length;
    const prefix = range.cloneRange();
    prefix.selectNodeContents(root);
    prefix.setEnd(range.endContainer, range.endOffset);
    return prefix.toString().length;
}

export function getSelectionOffsets(root: HTMLElement): { start: number; end: number } {
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

export function setSelectionOffsets(root: HTMLElement, start: number, end: number): void {
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

export function replaceVisibleRange(root: HTMLElement, start: number, end: number, replacement: Node): void {
    const startPoint = pointAtOffset(root, start);
    const endPoint = pointAtOffset(root, end);
    const range = root.ownerDocument.createRange();
    range.setStart(startPoint.node, startPoint.offset);
    range.setEnd(endPoint.node, endPoint.offset);
    range.deleteContents();
    range.insertNode(replacement);
}

export function pointAtOffset(root: HTMLElement, offset: number): { node: Node; offset: number } {
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

export function placeCaretAtEnd(node: Node): void {
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

export function insertAtSelection(root: HTMLElement, node: Node): void {
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

export function safeDecodeURIComponent(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}
