/**
 * Recovers the plain label from an inline Markdown link, or returns the value
 * unchanged when it is not a link so legacy plain-text fields keep parsing.
 */
export function unwrapMarkdownLinkLabel(value: string): string {
    const match = value.match(/^\[((?:\\.|[^\]\\])*)\]\([^)]*\)$/);
    return match ? match[1].replace(/\\([[\]\\])/g, "$1") : value;
}
