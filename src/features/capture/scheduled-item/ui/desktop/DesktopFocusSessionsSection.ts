import type { ScannedFocusSession } from "../../../../focus-session/domain/FocusSessionBlockScan.ts";

export interface DesktopFocusSessionsSectionOptions {
    sessions: ScannedFocusSession[];
    onEdit(session: ScannedFocusSession): void;
}

/**
 * Edit-mode-only: lists every Focus Session already logged against this Event/Task (read from the
 * canonical block, via scanFocusSessionsInBlock) with an Edit affordance per row, so mood/emotion/
 * reflection can be added or corrected after the fact — the Focus Session counterpart to the
 * "Manage Timeboxes" entry point already rendered by DesktopTemporalSection for Tasks.
 */
export function renderDesktopFocusSessionsSection(
    container: HTMLElement,
    options: DesktopFocusSessionsSectionOptions,
): void {
    if (options.sessions.length === 0) return;

    const header = container.createDiv({ cls: "fn-focus-sessions-header" });
    header.createEl("h3", { text: "Session history" });
    header.createSpan({ text: `${options.sessions.length} logged`, cls: "fn-focus-sessions-count" });
    const list = container.createDiv({ cls: "fn-focus-sessions-list" });
    for (const session of options.sessions) {
        const row = list.createDiv({ cls: "fn-focus-sessions-row" });
        row.createSpan({ cls: "fn-focus-sessions-summary", text: summarize(session) });
        const editBtn = row.createEl("button", {
            text: "Open",
            attr: { type: "button", "aria-label": "Open focus session details" },
        });
        editBtn.addEventListener("click", () => options.onEdit(session));
    }
}

function summarize(session: ScannedFocusSession): string {
    const endTime = session.end.length >= 16 ? session.end.slice(11) : session.end;
    const mood = session.emotionKey ? ` · ${session.emotionKey}` : "";
    const notes = session.notes ? " · 📝" : "";
    const m = Math.floor(session.durationSeconds / 60);
    const duration = m > 0 ? `${m}m` : `${session.durationSeconds}s`;
    return `${session.start} → ${endTime} · ${duration} · ${session.mode}${mood}${notes}`;
}
