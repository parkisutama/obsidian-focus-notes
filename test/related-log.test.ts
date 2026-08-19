import assert from "node:assert/strict";
import test from "node:test";
import { formatRelatedLog } from "../src/RelatedLog.ts";

test("formats a self-contained Event historical log", () => {
    assert.equal(
        formatRelatedLog({
            kind: "event",
            title: "Discuss audit methodology at Head Office",
            occurredAt: new Date(2026, 7, 2, 9, 0),
            endedAt: new Date(2026, 7, 2, 10, 0),
            primaryFilePath: "Daily/2026-08-02.md",
            destinationFilePath: "People/Andi.md",
        }),
        "- 2026-08-02 09:00–10:00 — Discuss audit methodology at Head Office — [2026-08-02](../Daily/2026-08-02.md)",
    );
});

test("formats Task and Inbox logs without block identifiers", () => {
    const task = formatRelatedLog({
        kind: "task",
        title: "Submit audit report",
        occurredAt: new Date(2026, 7, 2, 17, 0),
        primaryFilePath: "Daily/2026-08-02.md",
        destinationFilePath: "Persona/Work/Projects/Audit/Activities/Field Review.md",
    });
    const inbox = formatRelatedLog({
        kind: "inbox",
        title: "Ask Salma about the archive",
        occurredAt: new Date(2026, 7, 2, 8, 8),
        primaryFilePath: "Daily/2026-08-02.md",
        destinationFilePath: "Books/Thinking.md",
    });

    assert.equal(task, "- 2026-08-02 17:00 — Submit audit report — [2026-08-02](../../../../../Daily/2026-08-02.md)");
    assert.equal(inbox, "- 2026-08-02 08:08 — Ask Salma about the archive — [2026-08-02](../Daily/2026-08-02.md)");
    assert.doesNotMatch(`${task}\n${inbox}`, /\^[A-Za-z0-9-]+/);
});

test("labels a non-Daily primary link with its file name", () => {
    assert.match(
        formatRelatedLog({
            kind: "task",
            title: "Review scope",
            occurredAt: new Date(2026, 7, 2, 10, 0),
            primaryFilePath: "Projects/Client Alpha.md",
            destinationFilePath: "People/Andi.md",
        }),
        /\[Client Alpha\]\(\.\.\/Projects\/Client%20Alpha\.md\)$/,
    );
});

test("uses an injected formatSourceLink instead of the default relative-link formatter", () => {
    const calls: Array<[string, string, string]> = [];
    const result = formatRelatedLog({
        kind: "event",
        title: "Discuss audit methodology",
        occurredAt: new Date(2026, 7, 2, 9, 0),
        endedAt: new Date(2026, 7, 2, 10, 0),
        primaryFilePath: "Daily/2026-08-02.md",
        destinationFilePath: "People/Andi.md",
        formatSourceLink: (targetFilePath, linkedFilePath, label) => {
            calls.push([targetFilePath, linkedFilePath, label]);
            return `[[${label}]]`;
        },
    });

    assert.deepEqual(calls, [["People/Andi.md", "Daily/2026-08-02.md", "2026-08-02"]]);
    assert.equal(result, "- 2026-08-02 09:00–10:00 — Discuss audit methodology — [[2026-08-02]]");
});

test("formats all-day Events without a misleading time range", () => {
    assert.equal(
        formatRelatedLog({
            kind: "event",
            title: "Field review",
            occurredAt: new Date(2026, 7, 2),
            endedAt: new Date(2026, 7, 3),
            allDay: true,
            primaryFilePath: "Daily/2026-08-02.md",
            destinationFilePath: "Places/Head Office.md",
            primaryLabel: "2026-08-02",
        }),
        "- 2026-08-02 — Field review — [2026-08-02](../Daily/2026-08-02.md)",
    );
});
