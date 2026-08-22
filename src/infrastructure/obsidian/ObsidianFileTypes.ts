import type { TFile, TFolder } from "obsidian";

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

/** Property-based TFolder detector; see isTFile for why instanceof is avoided. */
export function isTFolder(f: unknown): f is TFolder {
    if (!f || typeof f !== "object") return false;
    return "children" in f && !("extension" in f) && !("stat" in f);
}
