import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the canonical Focus Session writer resolves the owner via the shared mention index and is idempotent by sessionId", async () => {
    const source = await readFile(
        new URL("../src/infrastructure/obsidian/focus-session/CanonicalFocusSessionWriter.ts", import.meta.url),
        "utf8",
    );
    assert.match(source, /await source\.sync\(\);/);
    assert.match(source, /source\.findCandidate\(owner\.kind, owner\.itemId\);/);
    assert.match(source, /if \(!candidate\) return \{ status: "orphan" \};/);
    assert.match(source, /recordFocusSessionInBlock\(captured\.snapshot\.rawBlock, owner, fields, sessionId\);/);
    assert.match(source, /recorded\.status === "already-recorded"/);
    assert.match(source, /await app\.vault\.modify\(file, replaced\.content\);/);
});
