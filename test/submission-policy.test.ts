import assert from "node:assert/strict";
import test from "node:test";
import type { EventTaskSubmissionResult } from "../src/EventTaskSubmission.ts";
import { SubmissionPolicy } from "../src/SubmissionPolicy.ts";

const success: EventTaskSubmissionResult = {
    status: "success",
    message: "Saved.",
    createdNotes: { hubPath: null, detailPath: null },
};

const partial: EventTaskSubmissionResult = {
    status: "partial",
    message: "Saved with a related-note failure.",
    createdNotes: { hubPath: null, detailPath: null },
    primaryPath: "Daily.md",
    recovery: { completedPaths: [], failedWrites: [] },
};

const failure: EventTaskSubmissionResult = {
    status: "failure",
    phase: "primary",
    message: "Failed.",
    createdNotes: { hubPath: null, detailPath: null },
};

test("accepts only one operation while a submission is in flight", async () => {
    const policy = new SubmissionPolicy();
    let resolveOperation: ((result: EventTaskSubmissionResult) => void) | undefined;
    const operation = new Promise<EventTaskSubmissionResult>((resolve) => {
        resolveOperation = resolve;
    });
    let calls = 0;

    const first = policy.run(() => {
        calls += 1;
        return operation;
    });
    const concurrent = await policy.run(() => {
        calls += 1;
        return Promise.resolve(success);
    });

    assert.equal(concurrent, null);
    assert.equal(calls, 1);
    resolveOperation?.(success);
    assert.deepEqual(await first, success);
});

test("allows retry after failure and completes after success", async () => {
    const policy = new SubmissionPolicy();

    assert.deepEqual(await policy.run(() => Promise.resolve(failure)), failure);
    assert.deepEqual(await policy.run(() => Promise.resolve(success)), success);
    assert.equal(await policy.run(() => Promise.resolve(success)), null);
});

test("treats partial as completed and does not rerun the full submission", async () => {
    const policy = new SubmissionPolicy();

    assert.deepEqual(await policy.run(() => Promise.resolve(partial)), partial);
    assert.equal(await policy.run(() => Promise.resolve(success)), null);
});

test("releases the in-flight state when an operation unexpectedly throws", async () => {
    const policy = new SubmissionPolicy();

    await assert.rejects(
        policy.run(() => Promise.reject(new Error("unexpected"))),
        /unexpected/,
    );
    assert.deepEqual(await policy.run(() => Promise.resolve(success)), success);
});
