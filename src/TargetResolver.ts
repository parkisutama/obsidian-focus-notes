import { App, moment } from "obsidian";
import { FocusNotesSettings, FocusTarget } from "./types";

/**
 * Resolves abstract targets (which may contain template tokens or be empty)
 * into concrete file paths.
 *
 * Why a separate class:
 *   The view, the writer, and the recent-entries reader all need to know
 *   "what file should I touch right now?". Centralizing the resolution logic
 *   stops three callers from drifting in how they treat empty paths,
 *   {{date}} tokens, and the Daily-Notes-plugin fallback.
 */

interface DailyNotesConfig {
    folder?: string;
    format?: string;
}

export class TargetResolver {
    constructor(private app: App, private settings: FocusNotesSettings) {}

    /**
     * Returns the abstract default target. The file may still contain tokens.
     * Use resolve() afterwards to expand them for actual file IO.
     */
    public getDefaultTarget(): FocusTarget {
        if (this.settings.useDailyNotesAsDefault) {
            const dn = this.readDailyNotesConfig();
            if (dn) {
                const folder = dn.folder ? `${dn.folder.replace(/\/+$/, "")}/` : "";
                const fmt = dn.format || this.settings.dailyNoteFormat;
                return {
                    file: `${folder}{{date:${fmt}}}.md`,
                    heading: this.settings.defaultTarget.heading,
                    position: this.settings.defaultTarget.position
                };
            }
        }
        return { ...this.settings.defaultTarget };
    }

    /**
     * The "what would actually be written right now" target.
     *
     * Per-field merge of liveTarget over the default: empty file or heading
     * in liveTarget falls through to the default's value. Position always
     * comes from liveTarget because there is no empty/sentinel value for it.
     *
     * Still abstract — call resolve() to expand {{date}} tokens.
     */
    public getActiveTarget(): FocusTarget {
        const def = this.getDefaultTarget();
        const live = this.settings.liveTarget;
        return {
            file: live.file.trim() || def.file,
            heading: live.heading.trim() || def.heading,
            position: live.position
        };
    }

    /**
     * Resolve the core Daily Notes target for an explicit capture date.
     * Returns null when that integration is unavailable; callers must surface
     * the failure instead of falling through to another configured target.
     */
    public getDailyNoteTarget(when: Date = new Date()): FocusTarget | null {
        const dailyNotes = this.readDailyNotesConfig();
        if (!dailyNotes) return null;
        const folder = dailyNotes.folder
            ? `${dailyNotes.folder.replace(/\/+$/, "")}/`
            : "";
        const format = dailyNotes.format || this.settings.dailyNoteFormat;
        return this.resolve({
            file: `${folder}{{date:${format}}}.md`,
            heading: "",
            position: this.settings.defaultTarget.position
        }, when);
    }

    /** Expand {{date}} / {{date:FORMAT}} tokens in the file path against `when`. */
    public resolve(target: FocusTarget, when: Date = new Date()): FocusTarget {
        return {
            file: this.expandPath(target.file, when),
            heading: target.heading,
            position: target.position
        };
    }

    private expandPath(template: string, when: Date): string {
        if (!template) return "";
        return template.replace(/\{\{date(?::([^}]+))?\}\}/g, (_match, fmt) => {
            const f = fmt || this.settings.dailyNoteFormat;
            return moment(when).format(f);
        });
    }

    /**
     * Defensively read the core Daily Notes plugin's options.
     * The internalPlugins API is officially private; we wrap the access in
     * try/catch and feature-test rather than typing it, so a future Obsidian
     * change degrades to "use settings defaults" instead of throwing.
     */
    private readDailyNotesConfig(): DailyNotesConfig | null {
        try {
            const internal = (this.app as unknown as {
                internalPlugins?: {
                    plugins?: Record<
                        string,
                        { enabled?: boolean; instance?: { options?: DailyNotesConfig } }
                    >;
                };
            }).internalPlugins;
            const dn = internal?.plugins?.["daily-notes"];
            if (!dn?.enabled) return null;
            const opts = dn.instance?.options;
            if (!opts) return null;
            return { folder: opts.folder, format: opts.format };
        } catch {
            return null;
        }
    }
}
