import type { FocusNotesSettings } from "./types";

// This file intentionally lives directly in the vault config directory rather
// than plugin-local data.json so settings survive uninstall/reinstall and can
// travel with Obsidian Sync. The legacy loader below performs the one-time move.
const STATE_FILENAME = "focus-notes-state.json";

interface StateAdapter {
    exists(path: string): Promise<boolean>;
    read(path: string): Promise<string>;
    write(path: string, contents: string): Promise<void>;
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

/**
 * Owns the external settings file lifecycle and serializes writes from immutable
 * JSON snapshots. A malformed or unreadable existing file stays protected for
 * the lifetime of this store instance so background settings writes cannot
 * destroy the user's recovery source.
 */
export class StateStore {
    private readonly app: StateStoreApp;
    private readonly mergeSettings: (saved: Partial<FocusNotesSettings>) => FocusNotesSettings;
    private readonly path: string;
    private canSave = true;
    private writeQueue: Promise<void> = Promise.resolve();

    constructor(app: StateStoreApp, mergeSettings: (saved: Partial<FocusNotesSettings>) => FocusNotesSettings) {
        this.app = app;
        this.mergeSettings = mergeSettings;
        this.path = normalizeStatePath(`${app.vault.configDir}/${STATE_FILENAME}`);
    }

    async load(legacyLoad: () => Promise<unknown>): Promise<StateLoadResult> {
        let exists: boolean;
        try {
            exists = await this.app.vault.adapter.exists(this.path);
        } catch (error) {
            return this.protectedFallback("unreadable", "Could not inspect state file.", error);
        }

        if (exists) return this.loadExisting();

        try {
            const legacy = await legacyLoad();
            if (legacy && typeof legacy === "object" && !Array.isArray(legacy)) {
                const settings = this.mergeSettings(legacy as Partial<FocusNotesSettings>);
                await this.writeSnapshot(JSON.stringify(settings, null, 2));
                return { status: "migrated", settings, canSave: true };
            }
        } catch (error) {
            console.warn("[Focus Notes] Legacy data migration skipped.", error);
        }

        const settings = this.mergeSettings({});
        await this.writeSnapshot(JSON.stringify(settings, null, 2));
        return { status: "missing", settings, canSave: true };
    }

    save(settings: FocusNotesSettings): Promise<boolean> {
        if (!this.canSave) {
            console.warn("[Focus Notes] Settings save skipped to protect an unreadable or malformed state file.");
            return Promise.resolve(false);
        }

        const snapshot = JSON.stringify(settings, null, 2);
        const write = this.writeQueue
            .catch(() => undefined)
            .then(() => this.app.vault.adapter.write(this.path, snapshot));
        this.writeQueue = write;
        return write.then(() => true);
    }

    private async loadExisting(): Promise<StateLoadResult> {
        let raw: string;
        try {
            raw = await this.app.vault.adapter.read(this.path);
        } catch (error) {
            return this.protectedFallback("unreadable", "Could not read state file.", error);
        }

        try {
            const parsed = JSON.parse(raw) as unknown;
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
                throw new Error("State root must be an object.");
            }
            return {
                status: "loaded",
                settings: this.mergeSettings(parsed as Partial<FocusNotesSettings>),
                canSave: true,
            };
        } catch (error) {
            return this.protectedFallback("malformed", "Could not parse state file.", error);
        }
    }

    private protectedFallback(status: "unreadable" | "malformed", message: string, error: unknown): StateLoadResult {
        this.canSave = false;
        console.error(`[Focus Notes] ${message} The existing file is left untouched for recovery.`, error);
        return { status, settings: this.mergeSettings({}), canSave: false };
    }

    private async writeSnapshot(snapshot: string): Promise<void> {
        await this.app.vault.adapter.write(this.path, snapshot);
    }
}

function normalizeStatePath(path: string): string {
    return path.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
}
