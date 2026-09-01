import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("mobile Moment edit screen has independent lifecycle and imports no desktop UI", async () => {
    const source = await readFile(
        new URL("../src/features/capture/moment/ui/mobile/MomentMobileEditScreen.ts", import.meta.url),
        "utf8",
    );
    assert.doesNotMatch(source, /\/desktop\//);
    assert.match(source, /extends Component/);
    assert.match(source, /registerViewportLifecycle/);
    assert.match(source, /onunload/);
});

test("openMomentEditor branches to the mobile screen via shouldUseMobileForm", async () => {
    const source = await readFile(
        new URL("../src/features/capture/moment/ui/MomentEditor.ts", import.meta.url),
        "utf8",
    );
    assert.match(source, /shouldUseMobileForm/);
    assert.match(source, /MomentMobileEditScreen/);
    assert.match(source, /MomentDesktopEditModal/);
});
