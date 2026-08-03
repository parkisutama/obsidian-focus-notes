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

export type DisplayMode = "pomodoro" | "timer" | "stopwatch";
export type EngineMode = "countdown" | "stopwatch";
export type TimerStatus = "idle" | "running" | "paused" | "completed";
export type InsertPosition = "start" | "end";
export type StressLevel = "low" | "normal" | "medium" | "high";
export type EmotionCategory = "pleasant" | "neutral" | "unpleasant";
export type { TimelineMode } from "./ScheduledItemTypes";
import type { TimelineMode } from "./ScheduledItemTypes";

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

    /** Where logs go when the user has not overridden the target in the sidebar. */
    defaultTarget: FocusTarget;

    /**
     * Live override of the target, edited from the sidebar.
     *
     * Per-field fallback semantics: if liveTarget.file is "" the writer falls
     * back to defaultTarget.file (same for heading). This lets the user clear
     * a field to "follow the default" without remembering its exact value.
     * Position is always set (start | end), so it has no fallback notion.
     */
    liveTarget: FocusTarget;

    /**
     * If true, the default file path is auto-derived from the core Daily Notes
     * plugin's folder + format settings (read defensively from internalPlugins).
     * The user can still override per-session in the sidebar.
     */
    useDailyNotesAsDefault: boolean;
    /** Format string used for {{date}} when no explicit format is given. */
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

    /** Event & task creation settings. */
    eventTask: EventTaskSettings;

    /** Inbox quick-capture settings. */
    inbox: InboxSettings;
}

export interface FocusTimelineSettings {
    enabled: boolean;
    defaultMode: TimelineMode;
    multiDaySpanDays: number;
    weekStartsOn: number;
    sourceFolders: string[];
    showCompletedTasks: boolean;
    showPendingSummary: boolean;
    sourceSidebarCollapsed: boolean;
    sourceVisibility: Record<string, boolean>;
    sourceColors: Record<string, string>;
}

export interface EventTaskSettings {
    /** Folder where newly-created hub (catatan terkait) notes are placed. */
    hubNotesFolder: string;
    /** Default heading in the target file to insert event/task lines under. */
    defaultSaveHeading: string;
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

export type InboxTargetMode = "daily-note" | "event-task-target";

export interface ContextSourceFilter {
    property: string;
    value: string;
}

export interface ContextSourceSettings {
    id: string;
    name: string;
    icon: string;
    folders: string[];
    filter: ContextSourceFilter | null;
    relatedHeading: string;
    /** Optional vault-relative template note used when object creation is enabled. */
    templatePath: string;
    enabled: boolean;
}

export interface InboxSettings {
    /** Default destination strategy for Inbox captures. */
    defaultTargetMode: InboxTargetMode;
    /** Heading text without leading # characters. */
    heading: string;
    /** Where a new capture is inserted inside the Inbox heading. */
    position: InsertPosition;
    /** Canonical contextual object sources. */
    contextSources: ContextSourceSettings[];
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
    defaultTarget: {
        file: "Journal/{{date:YYYY-MM-DD}}.md",
        heading: "Focus timeline",
        position: "end",
    },
    liveTarget: {
        file: "",
        heading: "",
        position: "end",
    },
    useDailyNotesAsDefault: true,
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
        sourceFolders: ["Journal"],
        showCompletedTasks: true,
        showPendingSummary: true,
        sourceSidebarCollapsed: false,
        sourceVisibility: {},
        sourceColors: {},
    },
    eventTask: {
        hubNotesFolder: "Notes",
        defaultSaveHeading: "Activities & Tasks",
        detailNotesFolder: "Notes",
        eventNoteTemplate: "# {{title}}\n\n{{description}}",
        taskNoteTemplate: "# {{title}}\n\n{{description}}",
        relatedFieldFormat: "[[{{date}}]]",
        includeStatus: true,
        includePriority: true,
        includeTags: true,
    },
    inbox: {
        defaultTargetMode: "daily-note",
        heading: "Inbox",
        position: "end",
        contextSources: [
            {
                id: "people",
                name: "People",
                icon: "user",
                folders: ["People"],
                filter: null,
                relatedHeading: "Interactions",
                templatePath: "",
                enabled: true,
            },
            {
                id: "places",
                name: "Places",
                icon: "map-pin",
                folders: ["Place"],
                filter: null,
                relatedHeading: "Related log",
                templatePath: "",
                enabled: true,
            },
            {
                id: "activities",
                name: "Activities",
                icon: "activity",
                folders: ["Activities"],
                filter: { property: "type", value: "activity" },
                relatedHeading: "Activity log",
                templatePath: "",
                enabled: true,
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
    return {
        ...DEFAULT_SETTINGS,
        ...saved,
        defaultTarget: {
            ...DEFAULT_SETTINGS.defaultTarget,
            ...((saved.defaultTarget ?? {}) as Partial<typeof DEFAULT_SETTINGS.defaultTarget>),
        },
        liveTarget: {
            ...DEFAULT_SETTINGS.liveTarget,
            ...((saved.liveTarget ?? {}) as Partial<typeof DEFAULT_SETTINGS.liveTarget>),
        },
        timeline: {
            ...DEFAULT_SETTINGS.timeline,
            ...((saved.timeline ?? {}) as Partial<typeof DEFAULT_SETTINGS.timeline>),
            sourceFolders: [...(saved.timeline?.sourceFolders ?? DEFAULT_SETTINGS.timeline.sourceFolders)],
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
        inbox: {
            ...DEFAULT_SETTINGS.inbox,
            defaultTargetMode: savedInbox?.defaultTargetMode ?? DEFAULT_SETTINGS.inbox.defaultTargetMode,
            heading: savedInbox?.heading ?? DEFAULT_SETTINGS.inbox.heading,
            position: savedInbox?.position ?? DEFAULT_SETTINGS.inbox.position,
            contextSources,
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
            relatedHeading: stringValue(raw.relatedHeading).trim() || "Related log",
            templatePath: normalizeVaultFilePath(stringValue(raw.templatePath)),
            enabled: raw.enabled === true && folders.length > 0,
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
