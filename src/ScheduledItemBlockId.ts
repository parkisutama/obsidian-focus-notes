import type { ScheduledItemKind } from "./ScheduledItemTypes.ts";

const TRAILING_BLOCK_ID = /\s+\^([A-Za-z0-9][A-Za-z0-9_-]*)\s*$/;
const BASE32_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
const RANDOM_SUFFIX_LENGTH = 10;

export interface ScheduledItemBlockIdentity {
    semanticLine: string;
    blockId: string | null;
}

export function extractScheduledItemBlockId(line: string): ScheduledItemBlockIdentity {
    const match = line.match(TRAILING_BLOCK_ID);
    if (!match || match.index === undefined) return { semanticLine: line, blockId: null };
    return { semanticLine: line.slice(0, match.index), blockId: match[1] };
}

export function appendScheduledItemBlockId(line: string, blockId: string): string {
    const current = extractScheduledItemBlockId(line);
    return current.blockId ? line : `${line} ^${blockId}`;
}

export function createScheduledItemBlockId(kind: ScheduledItemKind): string {
    const random = new Uint8Array(RANDOM_SUFFIX_LENGTH);
    crypto.getRandomValues(random);
    const suffix = Array.from(random, (value) => BASE32_ALPHABET[value & 31]).join("");
    return `${kind}-${suffix}`;
}

export function formatScheduledItemBlockTarget(filePath: string, blockId: string): string {
    return `${filePath}#^${blockId}`;
}
