import type { ScheduledItemKind } from "./ScheduledItem.ts";

const TRAILING_BLOCK_ID = /\s+\^([A-Za-z0-9][A-Za-z0-9_-]*)\s*$/;
const BASE32_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
const RANDOM_SUFFIX_LENGTH = 10;

export type DerivedBlockIdNamespace = "timebox" | "focus" | "task-ref" | "event-ref" | "focus-ref";

export type ScheduledItemBlockIdKind =
    | "moment"
    | "task"
    | "event"
    | "timebox"
    | "focus-session"
    | "task-reference"
    | "event-reference"
    | "focus-reference"
    | "unknown";

const BLOCK_ID_NAMESPACES: ReadonlyArray<[RegExp, ScheduledItemBlockIdKind]> = [
    [/^moment-[0123456789abcdefghjkmnpqrstvwxyz]{10}$/, "moment"],
    [/^task-ref-[0123456789abcdefghjkmnpqrstvwxyz]{10}$/, "task-reference"],
    [/^event-ref-[0123456789abcdefghjkmnpqrstvwxyz]{10}$/, "event-reference"],
    [/^focus-ref-[0123456789abcdefghjkmnpqrstvwxyz]{10}$/, "focus-reference"],
    [/^timebox-[0123456789abcdefghjkmnpqrstvwxyz]{10}$/, "timebox"],
    [/^focus-[0123456789abcdefghjkmnpqrstvwxyz]{10}$/, "focus-session"],
    [/^task-[0123456789abcdefghjkmnpqrstvwxyz]{10}$/, "task"],
    [/^event-[0123456789abcdefghjkmnpqrstvwxyz]{10}$/, "event"],
];

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
    return createNamespacedBlockId(kind);
}

export function createDerivedBlockId(namespace: DerivedBlockIdNamespace): string {
    return createNamespacedBlockId(namespace);
}

export function createMomentBlockId(createId: () => string = () => createNamespacedBlockId("moment")): string {
    return createId();
}

export function classifyScheduledItemBlockId(blockId: string): ScheduledItemBlockIdKind {
    for (const [pattern, kind] of BLOCK_ID_NAMESPACES) {
        if (pattern.test(blockId)) return kind;
    }
    return "unknown";
}

function createNamespacedBlockId(namespace: ScheduledItemKind | DerivedBlockIdNamespace | "moment"): string {
    const random = new Uint8Array(RANDOM_SUFFIX_LENGTH);
    crypto.getRandomValues(random);
    const suffix = Array.from(random, (value) => BASE32_ALPHABET[value & 31]).join("");
    return `${namespace}-${suffix}`;
}

export function formatScheduledItemBlockTarget(filePath: string, blockId: string): string {
    return `${filePath}#^${blockId}`;
}
