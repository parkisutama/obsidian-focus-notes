export function expandObjectNoteTemplate(template: string, title: string, createdAt: Date): string {
    const date = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, "0")}-${String(createdAt.getDate()).padStart(2, "0")}`;
    const time = `${String(createdAt.getHours()).padStart(2, "0")}:${String(createdAt.getMinutes()).padStart(2, "0")}`;
    const tokens: Record<string, string> = { title, name: title, date, time };
    return template.replace(/\{\{(title|name|date|time)\}\}/g, (_, token: string) => tokens[token] ?? "");
}
