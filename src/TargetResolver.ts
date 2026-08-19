import { type App, moment } from "obsidian";
import { normalizeDailyNoteFormat } from "./DailyNotePath";
import type { FocusNotesSettings, FocusTarget, PeriodicalNoteProfile } from "./types";

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
    constructor(
        private app: App,
        private settings: FocusNotesSettings,
    ) {}

    /**
     * Returns the abstract default target for Focus session logging. The file
     * may still contain {{date}} tokens — use resolve() afterwards to expand
     * them for actual file IO. This is what the sidebar's editable "Save to"
     * fields display, so file stays a literal template; heading is resolved
     * for "now" when the chosen profile has a headingFormat (there is no
     * sensible way to show a dated-heading template as editable plain text).
     */
    public getDefaultTarget(): FocusTarget {
        const s = this.settings.captureFocusSession;
        const profile = this.findProfile(s.profileId);
        const file = this.getProfileFileTemplate(s.profileId) ?? "";
        const heading = profile?.headingFormat ? moment().format(profile.headingFormat) : s.heading;
        return { file, heading, position: s.position };
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
            position: live.position,
        };
    }

    /**
     * Resolve a user-defined Periodical Note profile for an explicit date.
     * Returns null when no profile with that id exists — callers must surface
     * that rather than silently falling back elsewhere.
     *
     * The reserved "daily" profile optionally syncs its folder/fileFormat live
     * from the core Daily Notes plugin (settings.periodicalNotes.
     * syncDailyFromCorePlugin); every other profile is always resolved purely
     * from its own manual fields, so this never hard-depends on that plugin.
     */
    public getPeriodicalTarget(profileId: string, when: Date = new Date()): FocusTarget | null {
        const profile = this.findProfile(profileId);
        if (!profile) return null;
        const { folder, fileFormat } = this.resolveProfileFolderAndFormat(profile);
        const folderPrefix = folder ? `${folder.replace(/\/+$/, "")}/` : "";
        const format = normalizeDailyNoteFormat(fileFormat, "YYYY-MM-DD");
        const resolved = this.resolve(
            { file: `${folderPrefix}{{date:${format}}}.md`, heading: "", position: "end" },
            when,
        );
        const heading = profile.headingFormat ? moment(when).format(profile.headingFormat) : "";
        return { ...resolved, heading };
    }

    /**
     * Unresolved file-name template for a Periodical Note profile (the
     * {{date:FORMAT}} token stays literal) — what the Focus session sidebar's
     * editable "Save to" field shows. Null when no profile with that id exists.
     */
    public getProfileFileTemplate(profileId: string): string | null {
        const profile = this.findProfile(profileId);
        if (!profile) return null;
        const { folder, fileFormat } = this.resolveProfileFolderAndFormat(profile);
        const folderPrefix = folder ? `${folder.replace(/\/+$/, "")}/` : "";
        const format = normalizeDailyNoteFormat(fileFormat, "YYYY-MM-DD");
        return `${folderPrefix}{{date:${format}}}.md`;
    }

    /**
     * Folder for a Periodical Note profile (no date expansion), or null when
     * no profile with that id exists. Used for Timeline auto-inclusion and
     * Detail Note folder placement. Replaces the old Daily-Notes-only
     * getDailyNoteFolder() with the same core-plugin-sync behavior, scoped to
     * whichever profile id is asked for.
     */
    public getProfileFolder(profileId: string): string | null {
        const profile = this.findProfile(profileId);
        if (!profile) return null;
        const { folder } = this.resolveProfileFolderAndFormat(profile);
        const normalized = folder
            .trim()
            .replace(/\\/g, "/")
            .replace(/^\/+|\/+$/g, "");
        return normalized || null;
    }

    private findProfile(profileId: string): PeriodicalNoteProfile | null {
        return this.settings.periodicalNotes.profiles.find((profile) => profile.id === profileId) ?? null;
    }

    /**
     * Shared "daily" core-plugin-sync rule used by getPeriodicalTarget(),
     * getProfileFileTemplate(), and getProfileFolder() — the reserved "daily"
     * profile can read its folder/fileFormat live from the core Daily Notes
     * plugin when enabled; every other profile always uses its own fields.
     */
    private resolveProfileFolderAndFormat(profile: PeriodicalNoteProfile): { folder: string; fileFormat: string } {
        let folder = profile.folder;
        let fileFormat = profile.fileFormat;
        if (profile.id === "daily" && this.settings.periodicalNotes.syncDailyFromCorePlugin) {
            const dn = this.readDailyNotesConfig();
            if (dn) {
                folder = dn.folder ?? folder;
                fileFormat = normalizeDailyNoteFormat(dn.format, fileFormat);
            }
        }
        return { folder, fileFormat };
    }

    /**
     * Default folder to offer for a new Detail Note.
     *
     * Detail notes usually belong alongside the list note that owns the Task
     * or Event, so default to that note's own folder. A Daily Note is just a
     * place a Task is passing through before it gets filed elsewhere, so for
     * targets inside the configured Daily Notes folder this falls back to the
     * globally configured Detail Notes folder instead.
     */
    public getDetailNotesFolder(targetFile: string): string {
        const parent = targetFile.includes("/") ? targetFile.slice(0, targetFile.lastIndexOf("/")) : "";
        if (!parent) return this.settings.eventTask.detailNotesFolder;
        const dailyFolder = this.getProfileFolder("daily");
        const withinDailyNotes =
            dailyFolder !== null && (parent === dailyFolder || parent.startsWith(`${dailyFolder}/`));
        return withinDailyNotes ? this.settings.eventTask.detailNotesFolder : parent;
    }

    /** Expand {{date}} / {{date:FORMAT}} tokens in the file path against `when`. */
    public resolve(target: FocusTarget, when: Date = new Date()): FocusTarget {
        return {
            file: this.expandPath(target.file, when),
            heading: target.heading,
            position: target.position,
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
            const internal = (
                this.app as unknown as {
                    internalPlugins?: {
                        plugins?: Record<string, { enabled?: boolean; instance?: { options?: DailyNotesConfig } }>;
                    };
                }
            ).internalPlugins;
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
