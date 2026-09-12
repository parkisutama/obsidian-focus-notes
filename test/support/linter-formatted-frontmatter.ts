import assert from "node:assert/strict";

/**
 * A frontmatter shape styled the way Obsidian Linter commonly normalizes a note: keys already
 * settled into a stable order, an explicit empty-array style for an unset list property, and a
 * non-empty array for a set one. Shared across the creation, "Repair Object Notes", and
 * auto-repair-watcher tests so all three enforcement paths are proven against the same input
 * rather than three subtly different ones.
 */
export const LINTER_FORMATTED_FRONTMATTER: Record<string, unknown> = {
    aliases: [],
    tags: ["reference"],
    title: "Kantor Jakarta",
};

/**
 * Asserts a required-property write only ever appended the expected keys: every key that existed
 * before keeps its exact value and its relative order, and nothing else was added. This is what
 * "never fights Obsidian Linter's formatting" means at the level these tests can observe — the
 * fakes operate on the parsed frontmatter object, not the raw YAML text Linter itself reformats.
 */
export function assertAdditiveOnly(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    expectedAddedKeys: readonly string[],
): void {
    const beforeKeys = Object.keys(before);
    const afterKeys = Object.keys(after);
    assert.deepEqual(afterKeys.slice(0, beforeKeys.length), beforeKeys, "existing key order must be preserved");
    for (const key of beforeKeys) {
        assert.deepEqual(after[key], before[key], `existing value for "${key}" must be untouched`);
    }
    assert.deepEqual(
        afterKeys.slice(beforeKeys.length).sort(),
        [...expectedAddedKeys].sort(),
        "only the expected keys are appended",
    );
}
