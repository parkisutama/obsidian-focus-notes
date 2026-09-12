import assert from "node:assert/strict";
import test from "node:test";
import type { App, TFile } from "obsidian";
import { getTemplaterApi } from "../src/infrastructure/obsidian/templater/TemplaterApi.ts";

const targetFile = { path: "Objects/Places/Kantor.md", extension: "md", stat: {} } as unknown as TFile;

function appWithTemplater(templater: unknown): App {
    return { plugins: { plugins: { "templater-obsidian": { templater } } } } as unknown as App;
}

test("returns null when no plugins registry exists", () => {
    assert.equal(getTemplaterApi({} as unknown as App, targetFile), null);
});

test("returns null when the Templater plugin is not installed", () => {
    const app = { plugins: { plugins: {} } } as unknown as App;
    assert.equal(getTemplaterApi(app, targetFile), null);
});

test("returns null when the Templater plugin lacks the expected functions", () => {
    assert.equal(getTemplaterApi(appWithTemplater({}), targetFile), null);
    assert.equal(getTemplaterApi(appWithTemplater({ create_running_config: () => ({}) }), targetFile), null);
});

test("adapts create_running_config and parse_template into parseTemplate", async () => {
    const calls: unknown[] = [];
    const runningConfig = { marker: "config" };
    const app = appWithTemplater({
        create_running_config: (templateFile: TFile, target: TFile, runMode: number) => {
            calls.push(["create_running_config", templateFile, target, runMode]);
            return runningConfig;
        },
        parse_template: async (config: unknown, content: string) => {
            calls.push(["parse_template", config, content]);
            return `resolved:${content}`;
        },
    });

    const templater = getTemplaterApi(app, targetFile);
    assert.ok(templater);
    const result = await templater?.parseTemplate("<% tp.date.now() %>");

    assert.equal(result, "resolved:<% tp.date.now() %>");
    assert.deepEqual(calls, [
        ["create_running_config", targetFile, targetFile, 4],
        ["parse_template", runningConfig, "<% tp.date.now() %>"],
    ]);
});
