import type { FocusNotesSettings } from "./types";

// Releases before this migration stored settings outside the plugin directory.
// Keep this path read-only so existing users can move safely to data.json.
const LEGACY_STATE_FILENAME = "focus-notes-state.json";

interface StateAdapter {
    exists(path: string): Promise<boolean>;
    read(path: string): Promise<string>;
}

export interface StateStoreApp {
    vault: {
        configDir: string;
        adapter: StateAdapter;
    };
}

export type StateLoadStatus = "loaded" | "missing" | "migrated" | "unreadable" | "malformed";

export interface StateLoadResult {
    status: StateLoadStatus;
    settings: FocusNotesSettings;
    canSave: boolean;
}

type LoadPluginData = () => Promise<unknown>;
type SavePluginData = (settings: FocusNotesSettings) => Promise<void>;

/**
 * Keeps settings writes ordered while delegating canonical persistence to
 * Obsidian's Plugin.loadData()/saveData(). The old config-root file is only
 * read when data.json is absent, then migrated into standard plugin data.
 */
export class StateStore {
    private readonly app: StateStoreApp;
    private readonly mergeSettings: (saved: Partial<FocusNotesSettings>) => FocusNotesSettings;
    private readonly legacyPath: string;
    private canSave = true;
    private savePluginData: SavePluginData | null = null;
    private writeQueue: Promise<void> = Promise.resolve();

    constructor(app: StateStoreApp, mergeSettings: (saved: Partial<FocusNotesSettings>) => FocusNotesSettings) {
        this.app = app;
        this.mergeSettings = mergeSettings;
        this.legacyPath = normalizeStatePath(`${app.vault.configDir}/${LEGACY_STATE_FILENAME}`);
    }

    async load(loadPluginData: LoadPluginData, savePluginData: SavePluginData): Promise<StateLoadResult> {
        this.savePluginData = savePluginData;

        try {
            const stored = await loadPluginData();
            if (isSettingsObject(stored)) {
                return { status: "loaded", settings: this.mergeSettings(stored), canSave: true };
            }
        } catch (error) {
            return this.protectedFallback("unreadable", "Could not read standard plugin data.", error);
        }

        let legacyExists: boolean;
        try {
            legacyExists = await this.app.vault.adapter.exists(this.legacyPath);
        } catch (error) {
            return this.protectedFallback("unreadable", "Could not inspect legacy state file.", error);
        }

        if (legacyExists) return this.migrateLegacyState();

        const settings = this.mergeSettings({});
        await this.persistSnapshot(settings);
        return { status: "missing", settings, canSave: true };
    }

    save(settings: FocusNotesSettings): Promise<boolean> {
        if (!this.canSave || !this.savePluginData) {
            console.warn("[Focus Notes] Settings save skipped to protect unavailable settings data.");
            return Promise.resolve(false);
        }

        const snapshot = cloneSettings(settings);
        const write = this.writeQueue.catch(() => undefined).then(() => this.persistSnapshot(snapshot));
        this.writeQueue = write;
        return write.then(() => true);
    }

    private async migrateLegacyState(): Promise<StateLoadResult> {
        let raw: string;
        try {
            raw = await this.app.vault.adapter.read(this.legacyPath);
        } catch (error) {
            return this.protectedFallback("unreadable", "Could not read legacy state file.", error);
        }

        try {
            const parsed = JSON.parse(raw) as unknown;
            if (!isSettingsObject(parsed)) throw new Error("State root must be an object.");
            const settings = this.mergeSettings(parsed);
            await this.persistSnapshot(settings);
            return { status: "migrated", settings, canSave: true };
        } catch (error) {
            return this.protectedFallback("malformed", "Could not parse legacy state file.", error);
        }
    }

    private protectedFallback(status: "unreadable" | "malformed", message: string, error: unknown): StateLoadResult {
        this.canSave = false;
        console.error(`[Focus Notes] ${message} The existing file is left untouched for recovery.`, error);
        return { status, settings: this.mergeSettings({}), canSave: false };
    }

    private async persistSnapshot(settings: FocusNotesSettings): Promise<void> {
        if (!this.savePluginData) throw new Error("Plugin settings persistence is not initialized.");
        await this.savePluginData(cloneSettings(settings));
    }
}

function isSettingsObject(value: unknown): value is Partial<FocusNotesSettings> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneSettings(settings: FocusNotesSettings): FocusNotesSettings {
    return JSON.parse(JSON.stringify(settings)) as FocusNotesSettings;
}

function normalizeStatePath(path: string): string {
    return path.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
}
