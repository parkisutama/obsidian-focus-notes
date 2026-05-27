import type { TFile } from "obsidian";

/**
 * Property-based TFile detector.
 *
 * Why not `instanceof TFile`:
 *   In some Electron + bundler combinations, the TFile constructor we import
 *   from "obsidian" ends up being a different class identity than the one
 *   Obsidian's vault uses internally. `instanceof` then returns false on a
 *   real TFile, and any code that gates behaviour on the check silently
 *   misbehaves: NoteWriter throws "exists but is not a file", suggesters
 *   return empty lists, the recent-entries reader returns [].
 *
 * Duck-typing on TFile-specific fields avoids the trap. TFolder has `path`
 * but lacks `extension` and `stat`, so the two are cleanly distinguishable.
 */
export function isTFile(f: unknown): f is TFile {
    if (!f || typeof f !== "object") return false;
    return "extension" in f && "stat" in f;
}

export function startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function endOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export function addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

export function startOfWeek(date: Date, weekStartsOn: number): Date {
    const start = startOfDay(date);
    const normalizedStart = ((weekStartsOn % 7) + 7) % 7;
    const diff = (start.getDay() - normalizedStart + 7) % 7;
    return addDays(start, -diff);
}

export function getIsoWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function formatDayKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

export function formatTime(date: Date): string {
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
}
