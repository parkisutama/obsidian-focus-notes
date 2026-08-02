/** Return only Markdown links so the editor can offer a compact live-link row. */
export function extractMarkdownLinks(markdown: string): string[] {
    return markdown.match(/\[[^\]\n]+\]\([^\)\n]+\)/g) ?? [];
}
