import assert from "node:assert/strict";
import test from "node:test";
import { planScheduledItemBlockFormat } from "../src/features/capture/scheduled-item/domain/ScheduledItemBlockFormat.ts";

test("an already-canonical block reports unchanged", () => {
    const rawBlock = [
        "- [ ] Prepare invoice",
        "    - description: Coordinate with vendor",
        "    - timebox: start:2026-09-05 09:00 | end:2026-09-05 10:00 | status:planned ^timebox-aaaaaaaaaa",
        "    - focus-session: start:2026-09-05 09:12 | end:2026-09-05 09:37 | duration:25m | mode:pomodoro ^focus-aaaaaaaaaa",
    ].join("\n");

    assert.deepEqual(planScheduledItemBlockFormat(rawBlock), { status: "unchanged" });
});

test("converts the old notes: Reflection Notes prefix to canonical reflection-notes: in order", () => {
    const rawBlock = [
        "- [x] Write the report | stress:low | emotion:pleasant | mood:calm",
        "    - description: Coordinate with vendor",
        "    - notes: Went smoothly, finished ahead of schedule.",
    ].join("\n");

    const plan = planScheduledItemBlockFormat(rawBlock);
    assert.equal(plan.status, "needs-format");
    if (plan.status !== "needs-format") return;
    assert.equal(
        plan.normalizedBlock,
        [
            "- [x] Write the report | stress:low | emotion:pleasant | mood:calm",
            "    - description: Coordinate with vendor",
            "    - reflection-notes: Went smoothly, finished ahead of schedule.",
        ].join("\n"),
    );

    assert.deepEqual(planScheduledItemBlockFormat(plan.normalizedBlock), { status: "unchanged" });
});

test("promotes a Task Focus Session nested under its Timebox to a direct sibling, preserving both stable IDs", () => {
    const rawBlock = [
        "- [ ] Deep work",
        "    - timebox: start:2026-09-05 09:00 | end:2026-09-05 11:00 | status:planned ^timebox-aaaaaaaaaa",
        "        - focus-session: start:2026-09-05 09:12 | end:2026-09-05 09:37 | duration:25m | mode:pomodoro ^focus-aaaaaaaaaa",
    ].join("\n");

    const plan = planScheduledItemBlockFormat(rawBlock);
    assert.equal(plan.status, "needs-format");
    if (plan.status !== "needs-format") return;
    assert.equal(
        plan.normalizedBlock,
        [
            "- [ ] Deep work",
            "    - timebox: start:2026-09-05 09:00 | end:2026-09-05 11:00 | status:planned ^timebox-aaaaaaaaaa",
            "    - focus-session: start:2026-09-05 09:12 | end:2026-09-05 09:37 | duration:25m | mode:pomodoro ^focus-aaaaaaaaaa",
        ].join("\n"),
    );
    assert.match(plan.normalizedBlock, /timebox-aaaaaaaaaa/);
    assert.match(plan.normalizedBlock, /focus-aaaaaaaaaa/);

    assert.deepEqual(planScheduledItemBlockFormat(plan.normalizedBlock), { status: "unchanged" });
});

test("preserves unknown nested Markdown while reordering owned children", () => {
    const rawBlock = [
        "- [ ] Prepare invoice",
        "    - notes: Retrospective note.",
        "    - description: Coordinate with vendor",
        "    - [ ] Preserve this nested subtask",
        "        - nested detail",
    ].join("\n");

    const plan = planScheduledItemBlockFormat(rawBlock);
    assert.equal(plan.status, "needs-format");
    if (plan.status !== "needs-format") return;
    assert.equal(
        plan.normalizedBlock,
        [
            "- [ ] Prepare invoice",
            "    - description: Coordinate with vendor",
            "    - reflection-notes: Retrospective note.",
            "    - [ ] Preserve this nested subtask",
            "        - nested detail",
        ].join("\n"),
    );
});

test("reports invalid for an ambiguous block instead of proposing a change", () => {
    const rawBlock = [
        "- [ ] Prepare invoice",
        "    - description: One",
        "    - description: Two",
    ].join("\n");

    assert.deepEqual(planScheduledItemBlockFormat(rawBlock), { status: "invalid" });
});
