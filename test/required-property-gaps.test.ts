import assert from "node:assert/strict";
import test from "node:test";
import { computeRequiredPropertyGaps } from "../src/features/object-notes/domain/RequiredPropertyGaps.ts";
import type { RequiredPropertySchema } from "../src/features/object-notes/domain/RequiredPropertySchema.ts";

const schema: RequiredPropertySchema[] = [
    { property: "type", identityValue: "place", defaultValue: "place" },
    { property: "region", identityValue: null, defaultValue: "unknown" },
    { property: "visited", identityValue: null, defaultValue: "false" },
];

test("returns every entry when the note has no matching frontmatter", () => {
    assert.deepEqual(computeRequiredPropertyGaps({ requiredProperties: schema }, undefined), schema);
});

test("excludes entries whose property key already exists", () => {
    const gaps = computeRequiredPropertyGaps({ requiredProperties: schema }, { type: "place", region: "Jakarta" });
    assert.deepEqual(gaps, [schema[2]]);
});

test("treats present-but-falsy values as satisfied, not missing", () => {
    const gaps = computeRequiredPropertyGaps(
        { requiredProperties: schema },
        { type: "place", region: "", visited: false },
    );
    assert.deepEqual(gaps, []);
});

test("returns nothing for an empty schema", () => {
    assert.deepEqual(computeRequiredPropertyGaps({ requiredProperties: [] }, {}), []);
});
