/** Keep date folders inside the format while preventing an invalid trailing `/.md`. */
export function normalizeDailyNoteFormat(format: string | undefined, fallback: string): string {
    const normalized = (format ?? "").trim().replace(/\/+$/g, "");
    return normalized || fallback.trim().replace(/\/+$/g, "") || "YYYY-MM-DD";
}
