import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import {
    BODY_REGIONS,
    getMood,
    MOODS,
    moodsInQuadrant,
    QUADRANTS,
} from "../src/features/reflection/domain/MoodReference.ts";

test("Mood reference keeps its serialized catalog and lookup behavior stable", () => {
    assert.equal(Object.keys(MOODS).length, 39);
    assert.deepEqual(Object.keys(MOODS).slice(0, 2), ["anxious", "overwhelmed"]);
    assert.equal(Object.keys(MOODS).at(-1), "present");
    assert.deepEqual(
        QUADRANTS.map((quadrant) => quadrant.key),
        ["high-pleasant", "high-unpleasant", "low-pleasant", "low-unpleasant"],
    );
    assert.deepEqual(
        BODY_REGIONS.map((region) => region.key),
        ["chest", "shoulders", "jaw", "breath", "stomach", "legs", "eyes", "hands"],
    );

    assert.equal(getMood("anxious")?.emoji, "😰");
    assert.equal(getMood("present")?.name, "Present");
    assert.equal(getMood("missing"), null);
    assert.equal(getMood(""), null);
    assert.equal(getMood(null), null);
    assert.equal(getMood(undefined), null);
    assert.deepEqual(
        moodsInQuadrant("high-pleasant").map((mood) => mood.key),
        [
            "confident",
            "curious",
            "determined",
            "energized",
            "engaged",
            "excited",
            "in-flow",
            "inspired",
            "motivated",
            "playful",
        ],
    );
});

test("Mood and somatic catalog references remain internally consistent", () => {
    for (const [key, mood] of Object.entries(MOODS)) {
        assert.equal(mood.key, key);
        assert.equal(mood.valence, mood.quadrant.endsWith("-pleasant") ? "pleasant" : "unpleasant");
        assert.equal(mood.arousal, mood.quadrant.startsWith("high") ? "high" : "low");
    }
    for (const region of BODY_REGIONS) {
        for (const row of region.sensations) {
            for (const key of row.candidateKeys) assert.ok(MOODS[key], `${region.key}/${row.sensation}: ${key}`);
            for (const key of row.disambiguation?.leftKeys ?? []) assert.ok(row.candidateKeys.includes(key));
            for (const key of row.disambiguation?.rightKeys ?? []) assert.ok(row.candidateKeys.includes(key));
        }
    }
});

test("Mood reference API stays small while static catalogs have cohesive owners", async () => {
    const domainUrl = new URL("../src/features/reflection/domain/", import.meta.url);
    await Promise.all([
        access(new URL("MoodCatalog.ts", domainUrl)),
        access(new URL("BodySensationCatalog.ts", domainUrl)),
        access(new URL("MoodTypes.ts", domainUrl)),
    ]);
    const apiSource = await readFile(new URL("MoodReference.ts", domainUrl), "utf8");
    assert.ok(apiSource.split(/\r?\n/).length < 100);
});
