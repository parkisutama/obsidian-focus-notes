import type {
    EventCaptureSettings,
    FocusSessionCaptureSettings,
    MomentCaptureSettings,
    TaskCaptureSettings,
} from "../../capture/domain/CaptureSettings";
import type { FocusTarget } from "../../capture/domain/CaptureTarget";
import type { EventTaskSettings } from "../../capture/scheduled-item/domain/DetailNoteSettings";
import type { DisplayMode } from "../../focus-session/domain/Timer.ts";
import type { InboxSettings } from "../../object-notes/domain/ContextSourceSettings";
import type { PeriodicalNotesSettings } from "../../periodical-notes/domain/PeriodicalNote";
import type { FocusTimelineSettings } from "../../timeline/domain/TimelineSettings";

export interface FocusNotesSettings {
    /** Default focus duration for the Pomodoro tab. */
    pomodoroMinutes: number;
    /** Default duration for the Timer tab. */
    timerMinutes: number;

    /** Last display mode selected in the sidebar. */
    lastMode: DisplayMode;

    /** Where Focus session logs go by default. */
    captureFocusSession: FocusSessionCaptureSettings;

    /** Live sidebar target override with per-field fallback semantics. */
    liveTarget: FocusTarget;

    /** Format string used for a bare {{date}} token. */
    dailyNoteFormat: string;

    /** Group Focus session entries below date sub-headings. */
    groupByDate: boolean;
    /** Heading level (#) for the date sub-heading when grouping is on. */
    dateSubHeadingLevel: 2 | 3 | 4;
    /** Template for the date sub-heading text. */
    dateSubHeadingTemplate: string;

    /** Flat and grouped Focus session log templates. */
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

    /** Persisted Object Source registry under the compatibility key `inbox`. */
    inbox: InboxSettings;

    /** User-defined periodical-note registry. */
    periodicalNotes: PeriodicalNotesSettings;

    /** Default Event capture destination. */
    captureEvent: EventCaptureSettings;

    /** Default Task capture destination. */
    captureTask: TaskCaptureSettings;

    /** Default Moment capture destination and backlink. */
    captureMoment: MomentCaptureSettings;
}
