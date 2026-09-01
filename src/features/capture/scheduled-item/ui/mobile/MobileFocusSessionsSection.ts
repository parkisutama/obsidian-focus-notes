import type { ScannedFocusSession } from "../../../../focus-session/domain/FocusSessionBlockScan.ts";

export function renderMobileFocusSessionsSection(
    container: HTMLElement,
    sessions: ScannedFocusSession[],
    onEdit: (session: ScannedFocusSession) => void,
): void {
    if (!sessions.length) return;
    container.createEl("h3", { text: "Focus sessions" });
    for (const session of sessions) {
        const row = container.createDiv({ cls: "fn-focus-sessions-row" });
        row.createSpan({ text: `${session.start} – ${session.end} · ${Math.round(session.durationSeconds / 60)}m` });
        row.createEl("button", { text: "Reflection", attr: { type: "button" } }).addEventListener("click", () =>
            onEdit(session),
        );
    }
}
