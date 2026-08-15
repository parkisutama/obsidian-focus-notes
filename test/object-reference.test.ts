import assert from "node:assert/strict";
import test from "node:test";
import {
    normalizeObjectReferencePath,
    parseObjectReferences,
    serializeObjectReference,
} from "../src/ObjectReference.ts";

test("parses unresolved and vault-root resolved Object References", () => {
    const text = "Ask @Rachel and @{People/Rachel Smith.md}; keep @Ops_Team informed.";

    assert.deepEqual(
        parseObjectReferences(text).map((occurrence) => ({ raw: occurrence.raw, reference: occurrence.reference })),
        [
            { raw: "@Rachel", reference: { label: "Rachel", vaultPath: null } },
            {
                raw: "@{People/Rachel Smith.md}",
                reference: { label: "Rachel Smith", vaultPath: "People/Rachel Smith.md" },
            },
            { raw: "@Ops_Team", reference: { label: "Ops_Team", vaultPath: null } },
        ],
    );
});

test("ignores email addresses, malformed references, and unsafe paths", () => {
    const text = "Mail user@example.com, keep @{People/Rachel open, reject @{../Secrets.md} and @{/Root.md}.";
    assert.deepEqual(parseObjectReferences(text), []);
});

test("normalizes separators and md suffix while rejecting paths outside the vault", () => {
    assert.equal(normalizeObjectReferencePath(" People\\Rachel "), "People/Rachel.md");
    assert.equal(normalizeObjectReferencePath("People//Rachel.md"), "People/Rachel.md");
    assert.equal(normalizeObjectReferencePath("../Rachel.md"), null);
    assert.equal(normalizeObjectReferencePath("/People/Rachel.md"), null);
    assert.equal(normalizeObjectReferencePath("People/./Rachel.md"), null);
});

test("serializes unresolved text and resolved paths without Markdown links", () => {
    assert.equal(serializeObjectReference({ label: "Rachel", vaultPath: null }), "@Rachel");
    assert.equal(
        serializeObjectReference({ label: "ignored alias", vaultPath: "People/Rachel Smith.md" }),
        "@{People/Rachel Smith.md}",
    );
    assert.equal(serializeObjectReference({ label: "Rachel Smith", vaultPath: null }), "@Rachel_Smith");
});
