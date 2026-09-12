import type { App, TFile } from "obsidian";
import { expandObjectNoteTemplate } from "../../../features/object-notes/domain/ObjectNoteTemplate.ts";
import type { RequiredPropertySchema } from "../../../features/object-notes/domain/RequiredPropertySchema";
import { getTemplaterApi } from "../templater/TemplaterApi.ts";

export interface RequiredPropertyContext {
    title: string;
    createdAt: Date;
    targetFile: TFile;
}

const TEMPLATER_EXPRESSION = /<%[\s\S]*?%>/;

/**
 * Identity entries always resolve to their exact value. Other entries expand the existing
 * {{title}}/{{date}}/{{time}} tokens, then hand off to Templater if the result still contains
 * <% %> syntax and Templater is installed. Templater absence or failure degrades to the raw
 * expanded string — this never throws, since a missing optional plugin must not block note
 * creation or repair.
 */
export async function resolveRequiredPropertyValue(
    app: App,
    entry: RequiredPropertySchema,
    context: RequiredPropertyContext,
): Promise<string> {
    if (entry.identityValue !== null) return entry.identityValue;

    const expanded = expandObjectNoteTemplate(entry.defaultValue, context.title, context.createdAt);
    if (!TEMPLATER_EXPRESSION.test(expanded)) return expanded;

    const templater = getTemplaterApi(app, context.targetFile);
    if (!templater) {
        console.warn(`[Focus Notes] Templater is not installed; using raw default for "${entry.property}"`);
        return expanded;
    }
    try {
        return await templater.parseTemplate(expanded);
    } catch (error) {
        console.warn(`[Focus Notes] Templater expression failed for "${entry.property}"; using raw default`, error);
        return expanded;
    }
}
