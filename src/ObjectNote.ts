import type { App, TFile } from "obsidian";
import type { ContextSourceSettings } from "./types";
import { ensureFolderPath, isTFile } from "./utils.ts";

export interface CreateObjectNoteInput {
    name: string;
    folder: string;
    createdAt?: Date;
}

export function buildObjectNotePath(folder: string, name: string): string {
    const safeName = name.replace(/[\\/:*?"<>|]/g, "_").trim() || "Untitled";
    const safeFolder = folder
        .trim()
        .replace(/\\/g, "/")
        .replace(/^\/+|\/+$/g, "");
    return safeFolder ? `${safeFolder}/${safeName}.md` : `${safeName}.md`;
}

export function expandObjectNoteTemplate(template: string, title: string, createdAt: Date): string {
    const date = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, "0")}-${String(createdAt.getDate()).padStart(2, "0")}`;
    const time = `${String(createdAt.getHours()).padStart(2, "0")}:${String(createdAt.getMinutes()).padStart(2, "0")}`;
    const tokens: Record<string, string> = { title, name: title, date, time };
    return template.replace(/\{\{(title|name|date|time)\}\}/g, (_, token: string) => tokens[token] ?? "");
}

export async function createObjectNote(
    app: App,
    source: ContextSourceSettings,
    input: CreateObjectNoteInput,
): Promise<TFile> {
    const folder = normalizeConfiguredFolder(input.folder);
    if (!source.enabled) throw new Error(`${source.name} is disabled.`);
    if (!source.folders.map(normalizeConfiguredFolder).includes(folder)) {
        throw new Error(`Choose a folder configured for ${source.name}.`);
    }
    if (!source.templatePath) throw new Error(`Configure a template note for ${source.name} first.`);

    const templateFile = app.vault.getAbstractFileByPath(source.templatePath);
    if (!isTFile(templateFile)) throw new Error(`Template note not found: ${source.templatePath}`);

    const path = buildObjectNotePath(folder, input.name);
    if (app.vault.getAbstractFileByPath(path)) throw new Error(`Object Note already exists: ${path}`);
    if (folder) await ensureFolderPath(app, folder);

    const template = await app.vault.read(templateFile);
    const created = await app.vault.create(
        path,
        expandObjectNoteTemplate(template, input.name.trim() || "Untitled", input.createdAt ?? new Date()),
    );
    if (source.filter) {
        await app.fileManager.processFrontMatter(created, (frontmatter) => {
            frontmatter[source.filter?.property ?? "type"] = source.filter?.value;
        });
    }
    return created;
}

function normalizeConfiguredFolder(folder: string): string {
    return folder
        .trim()
        .replace(/\\/g, "/")
        .replace(/^\/+|\/+$/g, "");
}
