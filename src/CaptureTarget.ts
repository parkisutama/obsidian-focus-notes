import type { FocusTarget } from "./types";

/** Prefer an explicitly active Markdown note while retaining configured placement. */
export function preferActiveNoteTarget(configured: FocusTarget, activeFilePath: string | null): FocusTarget {
    const active = activeFilePath?.trim() ?? "";
    if (!active.toLowerCase().endsWith(".md")) return { ...configured };
    return { ...configured, file: active };
}
