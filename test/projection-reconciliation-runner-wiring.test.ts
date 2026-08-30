import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("runProjectionReconciliation delegates every non-ambiguous item's create/remove to the existing incremental projection runners", async () => {
    const source = await readFile(
        new URL("../src/infrastructure/obsidian/capture/ProjectionReconciliationRunner.ts", import.meta.url),
        "utf8",
    );
    assert.match(source, /const taskReport = reconcileTaskDayReferences\(scan\.tasks, scan\.taskReferences\);/);
    assert.match(source, /const eventReport = reconcileEventDayReferences\(scan\.events, scan\.eventReferences\);/);
    assert.match(source, /if \(ambiguousTasks\.has\(task\.canonicalTarget\)\) continue;/);
    assert.match(source, /if \(ambiguousEvents\.has\(event\.canonicalTarget\)\) continue;/);
    assert.match(source, /await runTaskDayProjection\(/);
    assert.match(source, /await runEventDayProjection\(/);
});

test("repairOrphanProjectionReferences removes exactly the reported orphan references, nothing else", async () => {
    const source = await readFile(
        new URL("../src/infrastructure/obsidian/capture/ProjectionReconciliationRunner.ts", import.meta.url),
        "utf8",
    );
    assert.match(
        source,
        /await writer\.removeTaskDayReference\(ref\.destinationPath, ref\.canonicalTarget, ref\.timeboxId\);/,
    );
    assert.match(source, /await writer\.removeEventDayReference\(ref\.destinationPath, ref\.canonicalTarget\);/);
});

test("the plugin registers rebuild and repair commands wired to the reconciliation runner", async () => {
    const source = await readFile(new URL("../src/plugin/FocusNotesPlugin.ts", import.meta.url), "utf8");
    assert.match(source, /id: "rebuild-scheduled-item-projections"/);
    assert.match(source, /id: "repair-orphan-projection-references"/);
    assert.match(source, /void this\.rebuildProjections\(\);/);
    assert.match(source, /void this\.repairOrphanReferences\(\);/);
    assert.match(
        source,
        /const available = Boolean\(\s*summary && \(summary\.orphanTaskReferences\.length > 0 \|\| summary\.orphanEventReferences\.length > 0\),\s*\);/,
    );
});

test("TargetResolver can reverse-resolve a Daily Note's file path back to its calendar date", async () => {
    const source = await readFile(
        new URL("../src/infrastructure/obsidian/capture/TargetResolver.ts", import.meta.url),
        "utf8",
    );
    assert.match(source, /public resolveDailyFileDate\(filePath: string\): Date \| null \{/);
    assert.match(source, /moment\(basename, format, true\);/);
});
