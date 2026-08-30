import { MOODS } from "./MoodCatalog.ts";
import type { MoodEntry, Quadrant } from "./MoodTypes.ts";

export { BODY_REGIONS } from "./BodySensationCatalog.ts";
export { MOODS, QUADRANTS } from "./MoodCatalog.ts";
export type { Arousal, BodyRegion, MoodEntry, Quadrant, QuadrantMeta, SensationRow, Valence } from "./MoodTypes.ts";

export function getMood(key: string | null | undefined): MoodEntry | null {
    if (!key) return null;
    return MOODS[key] ?? null;
}

export function moodsInQuadrant(quadrant: Quadrant): MoodEntry[] {
    return Object.values(MOODS)
        .filter((mood) => mood.quadrant === quadrant)
        .sort((left, right) => left.name.localeCompare(right.name));
}
