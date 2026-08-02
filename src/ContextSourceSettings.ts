import type { ContextSourceSettings } from "./types";

export function createContextSource(existing: readonly ContextSourceSettings[]): ContextSourceSettings {
    const used = new Set(existing.map((source) => source.id));
    let id = "source";
    let suffix = 2;
    while (used.has(id)) {
        id = `source-${suffix}`;
        suffix += 1;
    }
    return {
        id,
        name: "New object",
        icon: "link",
        folders: [],
        filter: null,
        relatedHeading: "Related log",
        templatePath: "",
        enabled: false,
    };
}
