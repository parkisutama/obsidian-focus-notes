import type { ContextSourceSettings, InboxSettings } from "../../object-notes/domain/ContextSourceSettings";
import type { FocusNotesSettings } from "./FocusNotesSettings";

export const DEFAULT_SETTINGS: FocusNotesSettings = {
    pomodoroMinutes: 25,
    timerMinutes: 10,
    lastMode: "pomodoro",
    captureFocusSession: {
        profileId: "daily",
        heading: "Focus timeline",
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
    },
    captureTask: {
        allowedSourceIds: [],
        heading: "Activities & Tasks",
        position: "end",
    },
    periodicalNotes: {
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
        backlink: { enabled: true, profileId: "daily", heading: "Moments", position: "start" },
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
                relatedPosition: "start",
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
                relatedPosition: "start",
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
                relatedPosition: "start",
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
            relatedPosition: raw.relatedPosition === "end" ? "end" : "start",
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
