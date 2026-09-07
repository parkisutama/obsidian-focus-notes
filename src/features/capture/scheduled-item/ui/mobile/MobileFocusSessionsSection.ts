import type { ScannedFocusSession } from "../../../../focus-session/domain/FocusSessionBlockScan.ts";

export function renderMobileFocusSessionsSection(
    container: HTMLElement,
    sessions: ScannedFocusSession[],
    onEdit: (session: ScannedFocusSession) => void,
): void {
    if (!sessions.length) return;
    const header = container.createDiv({ cls: "fn-focus-sessions-header" });
    header.createEl("h3", { text: "Session history" });
    header.createSpan({ text: `${sessions.length} logged`, cls: "fn-focus-sessions-count" });
    for (const session of sessions) {
        const row = container.createDiv({ cls: "fn-focus-sessions-row" });
        row.createSpan({ text: `${session.start} – ${session.end} · ${Math.round(session.durationSeconds / 60)}m` });
        row.createEl("button", {
            text: "Open",
            attr: { type: "button", "aria-label": "Open focus session details" },
        }).addEventListener("click", () => onEdit(session));
    }
}
