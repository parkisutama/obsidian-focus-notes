import { type App, moment as obsidianMoment } from "obsidian";
import type { FocusTarget } from "../../../features/capture/domain/CaptureTarget";
import { resolveDetailNotesFolder } from "../../../features/capture/scheduled-item/domain/DetailNotesFolderResolution.ts";
import { normalizeDailyNoteFormat } from "../../../features/periodical-notes/domain/DailyNotePath";
import type { PeriodicalNoteProfile } from "../../../features/periodical-notes/domain/PeriodicalNote";
import type { FocusNotesSettings } from "../../../features/settings/domain/FocusNotesSettings";

interface ObsidianMomentValue {
    format(format: string): string;
    isValid(): boolean;
    toDate(): Date;
}

const moment = obsidianMoment as unknown as {
    (input?: Date): ObsidianMomentValue;
    (input: string, format: string, strict: boolean): ObsidianMomentValue;
};

/**
 * Resolves abstract targets (which may contain template tokens or be empty)
 * into concrete file paths.
 *
 * Why a separate class:
 *   The view, the writer, and the recent-entries reader all need to know
 *   "what file should I touch right now?". Centralizing the resolution logic
 *   stops three callers from drifting in how they treat empty paths and
 *   {{date}} tokens.
 */

export class TargetResolver {
    constructor(private settings: FocusNotesSettings) {}

    /**
     * The Focus session log target — always the configured "Focus session
     * capture" settings (Periodical profile + heading + position), with no
     * per-session override. The file may still contain {{date}} tokens — use
     * resolve() afterwards to expand them for actual file IO. Heading is
     * resolved for "now" when the chosen profile has a headingFormat (there is
     * no sensible way to show a dated-heading template as editable plain text).
     */
    public getDefaultTarget(): FocusTarget {
        const s = this.settings.captureFocusSession;
        const profile = this.findProfile(s.profileId);
        const file = this.getProfileFileTemplate(s.profileId) ?? "";
        const heading = profile?.headingFormat ? moment().format(profile.headingFormat) : s.heading;
        return { file, heading, position: s.position };
    }

    /**
     * Resolve a user-defined Periodical Note profile for an explicit date.
     * Returns null when no profile with that id exists — callers must surface
     * that rather than silently falling back elsewhere.
     */
    public getPeriodicalTarget(profileId: string, when: Date = new Date()): FocusTarget | null {
        const profile = this.findProfile(profileId);
        if (!profile) return null;
        const folderPrefix = profile.folder ? `${profile.folder.replace(/\/+$/, "")}/` : "";
        const format = normalizeDailyNoteFormat(profile.fileFormat, "YYYY-MM-DD");
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
        const folderPrefix = profile.folder ? `${profile.folder.replace(/\/+$/, "")}/` : "";
        const format = normalizeDailyNoteFormat(profile.fileFormat, "YYYY-MM-DD");
        return `${folderPrefix}{{date:${format}}}.md`;
    }

    /**
     * Folder for a Periodical Note profile (no date expansion), or null when
     * no profile with that id exists. Used for Timeline auto-inclusion and
     * Detail Note folder placement.
     */
    public getProfileFolder(profileId: string): string | null {
        const profile = this.findProfile(profileId);
        if (!profile) return null;
        const normalized = profile.folder
            .trim()
            .replace(/\\/g, "/")
            .replace(/^\/+|\/+$/g, "");
        return normalized || null;
    }

    /**
     * Reverse of getPeriodicalTarget("daily", ...): given a file path, returns the calendar date
     * it represents, or null when the path doesn't fall under the "daily" profile's configured
     * folder/format. Used by projection reconciliation (Task 45) to recover which day an existing
     * Task/Event day reference belongs to — that's implicit in which dated file it lives in, not
     * encoded in the reference line itself.
     */
    public resolveDailyFileDate(filePath: string): Date | null {
        const profile = this.findProfile("daily");
        if (!profile) return null;
        const folderPrefix = profile.folder ? `${profile.folder.replace(/\/+$/, "")}/` : "";
        if (!filePath.startsWith(folderPrefix)) return null;
        const format = normalizeDailyNoteFormat(profile.fileFormat, "YYYY-MM-DD");
        const basename = filePath.slice(folderPrefix.length).replace(/\.md$/, "");
        const parsed = moment(basename, format, true);
        return parsed.isValid() ? parsed.toDate() : null;
    }

    private findProfile(profileId: string): PeriodicalNoteProfile | null {
        return this.settings.periodicalNotes.profiles.find((profile) => profile.id === profileId) ?? null;
    }

    /**
     * Default folder to offer for a new Detail Note. `app` is only read for the "obsidianDefault"
     * strategy; everything else defers to the pure `resolveDetailNotesFolder` (see its own doc for
     * what each strategy means) so that logic stays directly unit-testable without an App.
     */
    public getDetailNotesFolder(app: App, targetFile: string, kind: "event" | "task"): string {
        const s = this.settings.eventTask;
        return resolveDetailNotesFolder(
            s,
            targetFile,
            kind,
            this.getProfileFolder("daily"),
            () => app.fileManager.getNewFileParent(targetFile).path,
        );
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
}
