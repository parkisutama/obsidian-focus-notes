import assert from "node:assert/strict";
import test from "node:test";
import {
    retryFailedRelatedWrites,
    writeRelatedDestinations,
    type RelatedWriteRequest,
} from "../src/RelatedWriteRecovery.ts";

const requests: RelatedWriteRequest[] = [
    { destinationPath: "People/Andi.md", heading: "Interactions", position: "end", markdown: "person log" },
    { destinationPath: "Places/Office.md", heading: "Mentions", position: "end", markdown: "place log" },
    { destinationPath: "Activities/Audit.md", heading: "Logs", position: "end", markdown: "activity log" },
];

test("records every success and failure while deduplicating destination paths", async () => {
    const attempted: string[] = [];
    const receipt = await writeRelatedDestinations([...requests, requests[0]], async (write) => {
        attempted.push(write.destinationPath);
        if (write.destinationPath === "Places/Office.md") throw new Error("read-only");
    });

    assert.deepEqual(attempted, ["People/Andi.md", "Places/Office.md", "Activities/Audit.md"]);
    assert.deepEqual(receipt.completedPaths, ["People/Andi.md", "Activities/Audit.md"]);
    assert.deepEqual(receipt.failedWrites, [{ ...requests[1], errorMessage: "read-only" }]);
});

test("retry attempts only current failures and never repeats completed destinations", async () => {
    const first = await writeRelatedDestinations(requests, async (write) => {
        if (write.destinationPath !== "People/Andi.md") throw new Error(`failed ${write.destinationPath}`);
    });
    const attempted: string[] = [];

    const second = await retryFailedRelatedWrites(first, async (write) => {
        attempted.push(write.destinationPath);
        if (write.destinationPath === "Activities/Audit.md") throw new Error("still read-only");
    });

    assert.deepEqual(attempted, ["Places/Office.md", "Activities/Audit.md"]);
    assert.deepEqual(second.completedPaths, ["People/Andi.md", "Places/Office.md"]);
    assert.deepEqual(second.failedWrites, [{ ...requests[2], errorMessage: "still read-only" }]);
});

test("repeated recovery carries successes forward and exposes only still-failed paths", async () => {
    const first = await writeRelatedDestinations(requests, async () => {
        throw new Error("offline");
    });
    const second = await retryFailedRelatedWrites(first, async (write) => {
        if (write.destinationPath === "Activities/Audit.md") throw new Error("locked");
    });
    const attempted: string[] = [];
    const third = await retryFailedRelatedWrites(second, async (write) => attempted.push(write.destinationPath));

    assert.deepEqual(attempted, ["Activities/Audit.md"]);
    assert.deepEqual(third.completedPaths, ["People/Andi.md", "Places/Office.md", "Activities/Audit.md"]);
    assert.deepEqual(third.failedWrites, []);
});
