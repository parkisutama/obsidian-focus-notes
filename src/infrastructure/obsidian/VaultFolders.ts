import type { App } from "obsidian";
import { isTFile } from "./ObsidianFileTypes.ts";

export async function ensureFolderPath(app: App, folderPath: string): Promise<void> {
    const parts = folderPath.split("/").filter(Boolean);
    let current = "";

    for (const part of parts) {
        current = current ? `${current}/${part}` : part;
        const existing = app.vault.getAbstractFileByPath(current);
        if (isTFile(existing)) {
            throw new Error(`Target folder path contains a file: ${current}`);
        }
        if (!existing) {
            await app.vault.createFolder(current).catch(() => {
                /* race tolerant: folder may exist already. */
            });
        }
    }
}
