/**
 * Shared types for Focus Notes.
 *
 * Two-layer mode design:
 *   DisplayMode  — three UI tabs (pomodoro | timer | stopwatch)
 *   EngineMode   — two state-machine flavors (countdown | stopwatch)
 *
 * Pomodoro and Timer collapse to the same engine path. The display mode
 * is preserved in the SessionRecord so the log line can show "pomodoro"
 * vs "timer" if the user wants that distinction in their {{mode}} token.
 */

import type { TimelineMode } from "./ScheduledItemTypes";

export type DisplayMode = "pomodoro" | "timer" | "stopwatch";
export type EngineMode = "countdown" | "stopwatch";
export type TimerStatus = "idle" | "running" | "paused" | "completed";
export type InsertPosition = "start" | "end";
export type StressLevel = "low" | "normal" | "medium" | "high";
export type EmotionCategory = "pleasant" | "neutral" | "unpleasant";
export type { TimelineMode } from "./ScheduledItemTypes";

export function toEngineMode(d: DisplayMode): EngineMode {
    return d === "stopwatch" ? "stopwatch" : "countdown";
}

/**
 * A logging target. The `file` field is a *template* and may contain
 * `{{date}}` or `{{date:FORMAT}}` tokens — TargetResolver expands them
 * at write time so "today's daily note" stays correct as the day rolls.
 */
export interface FocusTarget {
    file: string;
    heading: string;
    position: InsertPosition;
}

export interface FocusNotesSettings {
    /** Default focus duration for the Pomodoro tab. */
    pomodoroMinutes: number;
    /** Default duration for the Timer tab. */
    timerMinutes: number;

    /**
     * Last DisplayMode the user picked in the sidebar. Persisted so the
     * panel reopens where the user left off. Not user-editable in settings.
     */
    lastMode: DisplayMode;

    /** Where Focus session logs go by default — a Periodical Notes profile + heading + position. */
    captureFocusSession: FocusSessionCaptureSettings;

    /**
     * Live override of the target, edited from the sidebar.
     *
     * Per-field fallback semantics: if liveTarget.file is "" the writer falls
     * back to the resolved captureFocusSession target's file (same for
     * heading). This lets the user clear a field to "follow the default"
     * without remembering its exact value. Position is always set
     * (start | end), so it has no fallback notion.
     */
    liveTarget: FocusTarget;

    /** Format string used for a bare {{date}} token when no explicit format is given. */
    dailyNoteFormat: string;

    /**
     * Date grouping: when true, NoteWriter places each session under a date
     * sub-heading inside the main heading, creating the sub-heading on first
     * use. The reader walks sub-headings the same way. When false, the date
     * lives inside each bullet line as `{{date}}`.
     */
    groupByDate: boolean;
    /** Heading level (#) for the date sub-heading when grouping is on. */
    dateSubHeadingLevel: 2 | 3 | 4;
    /**
     * Template for the date sub-heading text. Default `[[{{date}}]]` produces
     * an Obsidian wikilink to the matching daily note (if names align).
     */
    dateSubHeadingTemplate: string;

    /**
     * Template for each log entry — one per group-by-date mode. They differ
     * structurally (the date-token belongs in the bullet for flat, in the
     * sub-heading for grouped), so we maintain both rather than mutate one.
     * Both support multi-line output for the sub-bullet visual hierarchy.
     */
    logFormatFlat: string;
    logFormatGrouped: string;

    /** Show the log modal automatically when a countdown completes. */
    autoOpenLogModal: boolean;
    /** Play a brief tone on countdown completion. */
    playSound: boolean;
    /** How many recent entries to surface in the sidebar preview. */
    recentEntriesCount: number;

    /** Timeline/planner view settings. */
    timeline: FocusTimelineSettings;

    /** Detail-note creation settings shared by Event and Task. */
    eventTask: EventTaskSettings;

    /** Inbox quick-capture settings. */
    inbox: InboxSettings;

    /** User-defined registry of periodical notes (daily, weekly, or any custom cadence). */
    periodicalNotes: PeriodicalNotesSettings;

    /** Where new Events default to — a Periodical Notes profile + heading + position + hub folder. */
    captureEvent: EventCaptureSettings;

    /** Where new Tasks default to — an Object Note (see TaskCaptureSettings), not a periodical note. */
    captureTask: TaskCaptureSettings;

    /** Where new Moments default to — a Periodical Notes profile (or the active Event target) + backlink. */
    captureMoment: MomentCaptureSettings;
}

/**
 * One periodical-note definition: where its files live and how they're named.
 * folder/fileFormat/headingFormat are all Moment.js format strings/templates —
 * see TargetResolver.getPeriodicalTarget() for how they're expanded.
 */
export interface PeriodicalNoteProfile {
    /** Stable id. "daily" is reserved — see PeriodicalNotesSettings.syncDailyFromCorePlugin. */
    id: string;
    /** Display name shown in profile pickers. */
    name: string;
    /** May itself contain {{date:FORMAT}} tokens for a dynamic subfolder. */
    folder: string;
    /** Moment.js format for the file name. */
    fileFormat: string;
    /** Moment.js format for a per-period heading inside the file. Empty = no dated sub-heading. */
    headingFormat: string;
}

/** Which Periodical Notes profile + heading + position one capture kind writes to. */
export interface CaptureHeadingTarget {
    profileId: string;
    /** Used verbatim when the resolved profile's headingFormat is empty. */
    heading: string;
    position: InsertPosition;
}

export type FocusSessionCaptureSettings = CaptureHeadingTarget;

export interface EventCaptureSettings extends CaptureHeadingTarget {
    hubNotesFolder: string;
}

/**
 * Task targets an Object Note rather than a Periodical Notes profile — a task
 * belongs in a project/task-list page, not a dated note. allowedSourceIds
 * scopes the "Save to" picker to notes from those Object Sources (combined,
 * deduplicated, ranked the same way the @ mention suggester already ranks
 * them); free-text path entry with full-vault suggestions remains available
 * when nothing configured matches what's typed.
 */
export interface TaskCaptureSettings {
    allowedSourceIds: string[];
    heading: string;
    position: InsertPosition;
    hubNotesFolder: string;
}

export interface PeriodicalNotesSettings {
    profiles: PeriodicalNoteProfile[];
    /**
     * When true, the "daily" profile's folder/fileFormat are read live from the
     * core Daily Notes plugin if it's enabled, falling back to that profile's
     * own manual fields otherwise. Never a hard requirement.
     */
    syncDailyFromCorePlugin: boolean;
}

export interface FocusTimelineSettings {
    enabled: boolean;
    defaultMode: TimelineMode;
    multiDaySpanDays: number;
    weekStartsOn: number;
    sourceFolders: string[];
    sourceHeadings: string[];
    showCompletedTasks: boolean;
    showPendingSummary: boolean;
    sourceSidebarCollapsed: boolean;
    sourceVisibility: Record<string, boolean>;
    sourceColors: Record<string, string>;
}

export interface EventTaskSettings {
    /** Folder where Event/Task Detail Notes are created. */
    detailNotesFolder: string;
    /** Body template for event detail notes. Tokens: {{title}}, {{date}}, {{start}}, {{end}}, {{description}}. */
    eventNoteTemplate: string;
    /** Body template for task detail notes. Tokens: {{title}}, {{date}}, {{due}}, {{start}}, {{end}}, {{remind}}, {{description}}. */
    taskNoteTemplate: string;
    /** Format for the `related` frontmatter field (links to target/daily note). {{date}} = event/task date, {{targetFile}} = target path. Empty = omit. */
    relatedFieldFormat: string;
    /** Include `status` field in detail note frontmatter. */
    includeStatus: boolean;
    /** Include `priority` field in task detail note frontmatter. */
    includePriority: boolean;
    /** Include `tags` field in detail note frontmatter. */
    includeTags: boolean;
}

export interface ContextSourceFilter {
    property: string;
    value: string;
}

export type ObjectNotePlacement = "flat" | "folder-note";

export interface ContextSourceSettings {
    id: string;
    name: string;
    icon: string;
    folders: string[];
    filter: ContextSourceFilter | null;
    /** Whether folders[] is required for a note to match this source. */
    matchByFolder: boolean;
    /** Whether filter is required for a note to match this source. */
    matchByProperty: boolean;
    relatedHeading: string;
    /** Optional vault-relative template note used when object creation is enabled. */
    templatePath: string;
    /** Default physical shape for new object notes. */
    placement: ObjectNotePlacement;
    enabled: boolean;
    /** Make matching object notes available as a property-filtered Focus Timeline source. */
    includeInTimeline: boolean;
}

export interface InboxSettings {
    /** Canonical contextual object sources, shared by the @ mention suggester and Task's picker. */
    contextSources: ContextSourceSettings[];
}

/**
 * Where new Moments default to. Unlike Event, Moment can also just reuse
 * whatever Event/Task's own active target resolves to (useEventCaptureTarget)
 * instead of a Periodical Notes profile. The optional backlink writes a
 * second short entry into another profile's file (e.g. a same-day line in
 * the Daily profile when the Moment itself lands in the Weekly profile).
 */
export interface MomentCaptureSettings {
    useEventCaptureTarget: boolean;
    /** Used when useEventCaptureTarget is false. */
    profileId: string;
    /** Fixed heading; used when useEventCaptureTarget is true, or the resolved profile has no headingFormat. */
    heading: string;
    position: InsertPosition;
    backlink: MomentBacklinkSettings;
}

export interface MomentBacklinkSettings {
    enabled: boolean;
    profileId: string;
    heading: string;
}

/** What gets passed to NoteWriter when a session ends. */
export interface SessionRecord {
    mode: DisplayMode;
    startTime: Date;
    endTime: Date;
    durationSeconds: number;
    /** Planned countdown length in seconds; null for stopwatch. */
    plannedSeconds: number | null;
    /** "What are you doing" — free text or a [[wikilink]]. */
    task: string;
    /** Reflection and notes — single field, head/heart/hand is just guidance. */
    notes: string;
    /** Selected stress level from Emotional Wellbeing, or null if skipped. */
    stressLevel: StressLevel | null;
    /** Unpleasant / Neutral / Pleasant category from Emotional Wellbeing. */
    emotionCategory: EmotionCategory | null;
    /** Specific emotion state from MoodReference, or null if user skipped. */
    moodKey: string | null;
    /**
     * Comma-separated wikilinks added in the modal's Related field.
     * Stored as the raw string the user typed; rendering joins them with spaces.
     */
    links: string;
}

export const DEFAULT_SETTINGS: FocusNotesSettings = {
    pomodoroMinutes: 25,
    timerMinutes: 10,
    lastMode: "pomodoro",
    captureFocusSession: {
        profileId: "daily",
        heading: "Focus timeline",
        position: "end",
    },
    liveTarget: {
        file: "",
        heading: "",
        position: "end",
    },
    dailyNoteFormat: "YYYY-MM-DD",

    // Date grouping defaults: off, level-3 sub-heading, [[wikilinked]] date so
    // it auto-links to the user's daily note when names match.
    groupByDate: false,
    dateSubHeadingLevel: 3,
    dateSubHeadingTemplate: "[[{{date}}]]",

    // Timeline-compatible by default: each completed timer session is also a
    // strict scheduled event line, so Focus Timeline can index it directly.
    // Grouped mode still keeps {{date}} in the bullet because the timeline
    // parser is intentionally line-based and does not infer dates from headings.
    logFormatFlat:
        "- {{date}} {{startTime}} - {{endTime}} {{task}}\n    - focus: {{duration}} · {{mode}}\n    - {{wellbeing}}\n    - {{notes}}\n    - {{links}}",
    logFormatGrouped:
        "- {{date}} {{startTime}} - {{endTime}} {{task}}\n    - focus: {{duration}} · {{mode}}\n    - {{wellbeing}}\n    - {{notes}}\n    - {{links}}",

    autoOpenLogModal: true,
    playSound: true,
    recentEntriesCount: 5,
    timeline: {
        enabled: true,
        defaultMode: "day",
        multiDaySpanDays: 7,
        weekStartsOn: 1,
        sourceFolders: [],
        sourceHeadings: ["Activities & Tasks"],
        showCompletedTasks: true,
        showPendingSummary: true,
        sourceSidebarCollapsed: false,
        sourceVisibility: {},
        sourceColors: {},
    },
    eventTask: {
        detailNotesFolder: "Notes",
        eventNoteTemplate: "# {{title}}\n\n{{description}}",
        taskNoteTemplate: "# {{title}}\n\n{{description}}",
        relatedFieldFormat: "[[{{date}}]]",
        includeStatus: true,
        includePriority: true,
        includeTags: true,
    },
    captureEvent: {
        profileId: "daily",
        heading: "Activities & Tasks",
        position: "end",
        hubNotesFolder: "Notes",
    },
    captureTask: {
        allowedSourceIds: [],
        heading: "Activities & Tasks",
        position: "end",
        hubNotesFolder: "Notes",
    },
    periodicalNotes: {
        syncDailyFromCorePlugin: true,
        profiles: [
            { id: "daily", name: "Daily", folder: "", fileFormat: "YYYY-MM-DD", headingFormat: "" },
            { id: "weekly", name: "Weekly", folder: "Weekly", fileFormat: "GGGG-[W]WW", headingFormat: "YYYY-MM-DD" },
        ],
    },
    captureMoment: {
        useEventCaptureTarget: false,
        profileId: "weekly",
        heading: "Inbox",
        position: "end",
        backlink: { enabled: true, profileId: "daily", heading: "Moments" },
    },
    inbox: {
        contextSources: [
            {
                id: "people",
                name: "People",
                icon: "user",
                folders: ["People"],
                filter: null,
                matchByFolder: true,
                matchByProperty: true,
                relatedHeading: "Interactions",
                templatePath: "",
                placement: "flat",
                enabled: true,
                includeInTimeline: false,
            },
            {
                id: "places",
                name: "Places",
                icon: "map-pin",
                folders: ["Place"],
                filter: null,
                matchByFolder: true,
                matchByProperty: true,
                relatedHeading: "Related log",
                templatePath: "",
                placement: "flat",
                enabled: true,
                includeInTimeline: false,
            },
            {
                id: "activities",
                name: "Activities",
                icon: "activity",
                folders: ["Activities"],
                filter: { property: "type", value: "activity" },
                matchByFolder: true,
                matchByProperty: true,
                relatedHeading: "Activity log",
                templatePath: "",
                placement: "flat",
                enabled: true,
                includeInTimeline: true,
            },
        ],
    },
};

/**
 * Merge persisted state with current defaults without sharing mutable arrays.
 * Kept independent of Obsidian runtime APIs so migrations are unit-testable.
 */
export function mergeSettingsWithDefaults(saved: Partial<FocusNotesSettings>): FocusNotesSettings {
    const savedInbox = saved.inbox as LegacyInboxSettings | undefined;
    const contextSources = normalizeContextSources(
        savedInbox?.contextSources,
        DEFAULT_SETTINGS.inbox.contextSources,
        savedInbox?.peopleFolders,
        savedInbox?.placeFolders,
    );
    const savedPeriodicalProfiles = saved.periodicalNotes?.profiles;
    const periodicalProfiles = Array.isArray(savedPeriodicalProfiles)
        ? savedPeriodicalProfiles.map((profile) => ({ ...profile }))
        : DEFAULT_SETTINGS.periodicalNotes.profiles.map((profile) => ({ ...profile }));
    return {
        ...DEFAULT_SETTINGS,
        ...saved,
        captureFocusSession: {
            ...DEFAULT_SETTINGS.captureFocusSession,
            ...((saved.captureFocusSession ?? {}) as Partial<typeof DEFAULT_SETTINGS.captureFocusSession>),
        },
        captureEvent: {
            ...DEFAULT_SETTINGS.captureEvent,
            ...((saved.captureEvent ?? {}) as Partial<typeof DEFAULT_SETTINGS.captureEvent>),
        },
        captureTask: {
            ...DEFAULT_SETTINGS.captureTask,
            ...((saved.captureTask ?? {}) as Partial<typeof DEFAULT_SETTINGS.captureTask>),
            allowedSourceIds: [
                ...(saved.captureTask?.allowedSourceIds ?? DEFAULT_SETTINGS.captureTask.allowedSourceIds),
            ],
        },
        liveTarget: {
            ...DEFAULT_SETTINGS.liveTarget,
            ...((saved.liveTarget ?? {}) as Partial<typeof DEFAULT_SETTINGS.liveTarget>),
        },
        timeline: {
            ...DEFAULT_SETTINGS.timeline,
            ...((saved.timeline ?? {}) as Partial<typeof DEFAULT_SETTINGS.timeline>),
            sourceFolders: [...(saved.timeline?.sourceFolders ?? DEFAULT_SETTINGS.timeline.sourceFolders)],
            sourceHeadings: [...(saved.timeline?.sourceHeadings ?? DEFAULT_SETTINGS.timeline.sourceHeadings)],
            sourceVisibility: {
                ...DEFAULT_SETTINGS.timeline.sourceVisibility,
                ...(saved.timeline?.sourceVisibility ?? {}),
            },
            sourceColors: {
                ...DEFAULT_SETTINGS.timeline.sourceColors,
                ...(saved.timeline?.sourceColors ?? {}),
            },
        },
        eventTask: {
            ...DEFAULT_SETTINGS.eventTask,
            ...((saved.eventTask ?? {}) as Partial<typeof DEFAULT_SETTINGS.eventTask>),
        },
        periodicalNotes: {
            syncDailyFromCorePlugin:
                saved.periodicalNotes?.syncDailyFromCorePlugin ??
                DEFAULT_SETTINGS.periodicalNotes.syncDailyFromCorePlugin,
            profiles: periodicalProfiles,
        },
        inbox: {
            contextSources,
        },
        captureMoment: {
            ...DEFAULT_SETTINGS.captureMoment,
            ...((saved.captureMoment ?? {}) as Partial<typeof DEFAULT_SETTINGS.captureMoment>),
            backlink: {
                ...DEFAULT_SETTINGS.captureMoment.backlink,
                ...(saved.captureMoment?.backlink ?? {}),
            },
        },
    };
}

function normalizeContextSources(
    saved: unknown,
    defaults: ContextSourceSettings[],
    legacyPeopleFolders?: string[],
    legacyPlaceFolders?: string[],
): ContextSourceSettings[] {
    const candidates = Array.isArray(saved)
        ? saved
        : defaults.map((source) => ({
              ...source,
              folders:
                  source.id === "people" && legacyPeopleFolders
                      ? legacyPeopleFolders
                      : source.id === "places" && legacyPlaceFolders
                        ? legacyPlaceFolders
                        : source.folders,
          }));
    const usedIds = new Map<string, number>();
    const result: ContextSourceSettings[] = [];
    for (const candidate of candidates) {
        if (!candidate || typeof candidate !== "object") continue;
        const raw = candidate as Partial<ContextSourceSettings>;
        const baseId = normalizeSourceId(stringValue(raw.id) || stringValue(raw.name) || "source");
        const occurrence = (usedIds.get(baseId) ?? 0) + 1;
        usedIds.set(baseId, occurrence);
        const folders = normalizeContextFolders(Array.isArray(raw.folders) ? raw.folders : []);
        const filter = raw.filter && typeof raw.filter === "object" ? raw.filter : null;
        const property = stringValue(filter?.property).trim();
        const value = stringValue(filter?.value).trim();
        result.push({
            id: occurrence === 1 ? baseId : `${baseId}-${occurrence}`,
            name: stringValue(raw.name).trim() || baseId,
            icon: stringValue(raw.icon).trim() || "link",
            folders,
            filter: property && value ? { property, value } : null,
            matchByFolder: raw.matchByFolder !== false,
            matchByProperty: raw.matchByProperty !== false,
            relatedHeading: stringValue(raw.relatedHeading).trim() || "Related log",
            templatePath: normalizeVaultFilePath(stringValue(raw.templatePath)),
            placement: raw.placement === "folder-note" ? "folder-note" : "flat",
            enabled: raw.enabled === true,
            includeInTimeline:
                raw.includeInTimeline === true ||
                (raw.includeInTimeline === undefined && ["activity", "project"].includes(value.toLowerCase())),
        });
    }
    return result;
}

type LegacyInboxSettings = Partial<InboxSettings> & {
    peopleFolders?: string[];
    placeFolders?: string[];
};

function normalizeVaultFilePath(path: string): string {
    const normalized = path
        .trim()
        .replace(/\\/g, "/")
        .replace(/^\/+|\/+$/g, "");
    if (normalized.split("/").some((part) => part === "." || part === "..")) return "";
    return normalized;
}

function normalizeContextFolders(folders: unknown[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const folder of folders) {
        if (typeof folder !== "string") continue;
        const normalized = folder
            .trim()
            .replace(/\\/g, "/")
            .replace(/^\/+|\/+$/g, "");
        const key = normalized.toLowerCase();
        if (!normalized || seen.has(key) || normalized.split("/").some((part) => part === "." || part === "..")) {
            continue;
        }
        seen.add(key);
        result.push(normalized);
    }
    return result;
}

function stringValue(value: unknown): string {
    return typeof value === "string" ? value : "";
}

function normalizeSourceId(value: string): string {
    return (
        value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "source"
    );
}
