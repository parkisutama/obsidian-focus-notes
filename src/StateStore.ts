import { type App, normalizePath } from "obsidian";
import { type FocusNotesSettings, mergeSettingsWithDefaults } from "./types";

/**
 * Where persistent settings live.
 *
 * We deliberately bypass Obsidian's plugin-local data.json mechanism in favour
 * of a file directly inside `.obsidian/`. The reason is uninstall-survival:
 * `.obsidian/plugins/focus-notes/` is wiped on uninstall, but the user's vault
 * config dir is not. Storing in the config dir means:
 *   - Reinstall preserves all settings (live target, defaults, group-by-date,
 *     templates) without the user re-entering anything.
 *   - Obsidian Sync (which syncs `.obsidian/`) propagates the state across
 *     devices.
 *   - The user's own backup of `.obsidian/` covers it.
 *
 * Path resolution uses `vault.configDir`, not a hard-coded ".obsidian", so we
 * respect users who have configured a different config folder name.
 */
const STATE_FILENAME = "focus-notes-state.json";

function statePath(app: App): string {
    return normalizePath(`${app.vault.configDir}/${STATE_FILENAME}`);
}

/**
 * Load settings, with one-time migration from the legacy data.json location.
 *
 * Migration logic: if the external file does not exist but the plugin has a
 * data.json from a previous install, copy it to the external location once.
 * This makes the upgrade transparent for existing users. The legacy data.json
 * is then left in place (Obsidian manages it); subsequent saves go to the
 * external file only, so it gradually becomes irrelevant.
 */
export async function loadState(app: App, legacyLoad: () => Promise<unknown>): Promise<FocusNotesSettings> {
    const adapter = app.vault.adapter;
    const path = statePath(app);

    try {
        if (await adapter.exists(path)) {
            const raw = await adapter.read(path);
            const parsed = JSON.parse(raw) as Partial<FocusNotesSettings>;
            return mergeSettingsWithDefaults(parsed);
        }
    } catch (err) {
        console.error(
            "[Focus Notes] Could not parse state file, falling back to defaults. The corrupted file is left untouched so it can be recovered.",
            err,
        );
        return mergeSettingsWithDefaults({});
    }

    // External file missing — try migrating from legacy data.json.
    try {
        const legacy = (await legacyLoad()) as Partial<FocusNotesSettings> | null;
        if (legacy && typeof legacy === "object") {
            const merged = mergeSettingsWithDefaults(legacy);
            await saveState(app, merged);
            return merged;
        }
    } catch (err) {
        // Best-effort migration; if it fails we just start fresh.
        console.warn("[Focus Notes] Legacy data migration skipped.", err);
    }

    // First install or no legacy data — write defaults so the file exists.
    const fresh = mergeSettingsWithDefaults({});
    await saveState(app, fresh);
    return fresh;
}

export async function saveState(app: App, settings: FocusNotesSettings): Promise<void> {
    const path = statePath(app);
    const json = JSON.stringify(settings, null, 2);
    await app.vault.adapter.write(path, json);
}
