import assert from "node:assert/strict";
import test from "node:test";
import { isTFolder } from "../src/utils.ts";

test("isTFolder accepts vault folder-shaped values across runtime boundaries", () => {
    assert.equal(isTFolder({ path: "Notes", name: "Notes", children: [] }), true);
});

test("isTFolder rejects files and unrelated values", () => {
    assert.equal(
        isTFolder({ path: "Notes/item.md", name: "item.md", extension: "md", stat: {} }),
        false
    );
    assert.equal(isTFolder(null), false);
});
