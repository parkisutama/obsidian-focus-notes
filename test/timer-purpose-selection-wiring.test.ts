import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Timer wires the required purpose selector into the sidebar and gates start on it", async () => {
    const source = await readFile(
        new URL("../src/features/focus-session/ui/TimerControls.ts", import.meta.url),
        "utf8",
    );
    assert.match(source, /import \{ TimerPurposeSelector \} from "\.\/TimerPurposeSelector\.ts";/);
    assert.match(source, /import \{ evaluateTimerStartGate \} from "\.\.\/domain\/TimerPurposeGate\.ts";/);
    assert.match(source, /this\.renderPurposeSelector\(parent\);/);
    assert.match(source, /const gate = evaluateTimerStartGate\(this\.purposeSelector\.getSelection\(\)\);/);
    assert.match(source, /if \(gate\.status === "blocked"\)/);
    assert.match(source, /this\.currentOwner = gate\.owner;/);
});

test("Timer clears the owner and purpose selection once a session's lifecycle ends", async () => {
    const controlsSource = await readFile(
        new URL("../src/features/focus-session/ui/TimerControls.ts", import.meta.url),
        "utf8",
    );
    assert.match(
        controlsSource,
        /clearOwner\(\): void \{\s*this\.currentOwner = null;\s*this\.purposeSelector\.reset\(\);/,
    );

    const workflowSource = await readFile(
        new URL("../src/features/focus-session/ui/TimerLogWorkflow.ts", import.meta.url),
        "utf8",
    );
    assert.match(workflowSource, /onSessionEnded: \(\) => void;/);
    assert.match(workflowSource, /this\.options\.onSessionEnded\(\);/);

    const viewSource = await readFile(
        new URL("../src/features/focus-session/ui/TimerView.ts", import.meta.url),
        "utf8",
    );
    assert.match(viewSource, /onSessionEnded: \(\) => this\.controls\.clearOwner\(\),/);
});
