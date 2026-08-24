import type { App } from "obsidian";
import type { FocusNotesSettings } from "../domain/FocusNotesSettings";

/** Narrow view each settings category renderer needs — not the whole plugin instance. */
export interface SettingsRenderContext {
    app: App;
    settings: FocusNotesSettings;
    saveSettings: () => Promise<void>;
    redisplay: () => void;
}
