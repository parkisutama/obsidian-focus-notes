import type { PeriodicalNoteProfile } from "./types";

export function createPeriodicalProfile(existing: readonly PeriodicalNoteProfile[]): PeriodicalNoteProfile {
    const used = new Set(existing.map((profile) => profile.id));
    let id = "profile";
    let suffix = 2;
    while (used.has(id)) {
        id = `profile-${suffix}`;
        suffix += 1;
    }
    return {
        id,
        name: "New profile",
        folder: "",
        fileFormat: "YYYY-MM-DD",
        headingFormat: "",
    };
}
