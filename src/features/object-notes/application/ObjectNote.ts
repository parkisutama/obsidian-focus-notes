import type { App, TFile } from "obsidian";
import type { ContextSourceSettings, ObjectNotePlacement } from "../domain/ContextSourceSettings";
import { expandObjectNoteTemplate } from "../domain/ObjectNoteTemplate.ts";
import { isTFile } from "../../../infrastructure/obsidian/vault/ObsidianFileTypes.ts";
import { resolveRequiredPropertyValue } from "../../../infrastructure/obsidian/object-notes/RequiredPropertyResolution.ts";
import { ensureFolderPath } from "../../../infrastructure/obsidian/vault/VaultFolders.ts";

export { expandObjectNoteTemplate } from "../domain/ObjectNoteTemplate.ts";

export interface CreateObjectNoteInput {
    name: string;
    folder: string;
    placement: ObjectNotePlacement;
    createdAt?: Date;
}

export function getCreatableObjectSources(sources: readonly ContextSourceSettings[]): ContextSourceSettings[] {
    return sources.filter((source) => source.enabled && source.folders.length > 0);
}

export function buildObjectNotePath(folder: string, name: string, placement: ObjectNotePlacement): string {
    const safeName = name.replace(/[\\/:*?"<>|]/g, "_").trim() || "Untitled";
    const safeFolder = folder
        .trim()
        .replace(/\\/g, "/")
        .replace(/^\/+|\/+$/g, "");
    if (placement === "folder-note") {
        return safeFolder ? `${safeFolder}/${safeName}/${safeName}.md` : `${safeName}/${safeName}.md`;
    }
    return safeFolder ? `${safeFolder}/${safeName}.md` : `${safeName}.md`;
}

export async function createObjectNote(
    app: App,
    source: ContextSourceSettings,
    input: CreateObjectNoteInput,
): Promise<TFile> {
    if (
        input.folder
            .replace(/\\/g, "/")
            .split("/")
            .some((part) => part === "." || part === "..")
    ) {
        throw new Error("The destination has an invalid folder path; remove . or .. segments.");
    }
    const folder = normalizeConfiguredFolder(input.folder);
    if (!source.enabled) throw new Error(`${source.name} is disabled.`);
    if (!source.folders.some((root) => isFolderWithinRoot(folder, root))) {
        throw new Error(`Choose a folder inside a configured source folder for ${source.name}.`);
    }
    const path = buildObjectNotePath(folder, input.name, input.placement);
    if (app.vault.getAbstractFileByPath(path)) throw new Error(`Object Note already exists: ${path}`);
    const destinationFolder = path.split("/").slice(0, -1).join("/");
    if (destinationFolder) await ensureFolderPath(app, destinationFolder);

    let template = `# {{title}}\n`;
    if (source.templatePath) {
        const templateFile = app.vault.getAbstractFileByPath(source.templatePath);
        if (!isTFile(templateFile)) throw new Error(`Template note not found: ${source.templatePath}`);
        template = await app.vault.read(templateFile);
    }
    const title = input.name.trim() || "Untitled";
    const createdAt = input.createdAt ?? new Date();
    const created = await app.vault.create(path, expandObjectNoteTemplate(template, title, createdAt));
    if (source.requiredProperties.length > 0) {
        const context = { title, createdAt, targetFile: created };
        const resolved = await Promise.all(
            source.requiredProperties.map(
                async (entry) => [entry.property, await resolveRequiredPropertyValue(app, entry, context)] as const,
            ),
        );
        await app.fileManager.processFrontMatter(created, (frontmatter) => {
            for (const [property, value] of resolved) frontmatter[property] = value;
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

function isFolderWithinRoot(folder: string, root: string): boolean {
    const normalizedFolder = normalizeConfiguredFolder(folder);
    const normalizedRoot = normalizeConfiguredFolder(root);
    return (
        Boolean(normalizedRoot) &&
        (normalizedFolder === normalizedRoot || normalizedFolder.startsWith(`${normalizedRoot}/`))
    );
}
