import assert from "node:assert/strict";
import test from "node:test";
import type { App, TFile } from "obsidian";
import { resolveRequiredPropertyValue } from "../src/infrastructure/obsidian/object-notes/RequiredPropertyResolution.ts";
import type { RequiredPropertySchema } from "../src/features/object-notes/domain/RequiredPropertySchema.ts";

const targetFile = { path: "Objects/Places/Kantor.md", extension: "md", stat: {} } as unknown as TFile;
const context = { title: "Kantor Jakarta", createdAt: new Date(2026, 7, 3, 14, 5), targetFile };

const appWithoutTemplater = { plugins: { plugins: {} } } as unknown as App;

function appWithTemplater(parse_template: (config: unknown, content: string) => Promise<string>): App {
    return {
        plugins: {
            plugins: {
                "templater-obsidian": {
                    templater: {
                        create_running_config: () => ({}),
                        parse_template,
                    },
                },
            },
        },
    } as unknown as App;
}

test("an identity entry resolves to its exact value, ignoring defaultValue", async () => {
    const entry: RequiredPropertySchema = { property: "type", identityValue: "place", defaultValue: "unused" };
    assert.equal(await resolveRequiredPropertyValue(appWithoutTemplater, entry, context), "place");
});

test("expands static tokens when no Templater syntax is present", async () => {
    const entry: RequiredPropertySchema = { property: "region", identityValue: null, defaultValue: "created {{date}}" };
    assert.equal(await resolveRequiredPropertyValue(appWithoutTemplater, entry, context), "created 2026-08-03");
});

test("does not probe for Templater at all when no <% %> syntax is present", async () => {
    const appThatThrowsIfTouched = {
        get plugins(): never {
            throw new Error("Templater probe should not run without <% %> in the default");
        },
    } as unknown as App;
    const entry: RequiredPropertySchema = { property: "region", identityValue: null, defaultValue: "static" };
    assert.equal(await resolveRequiredPropertyValue(appThatThrowsIfTouched, entry, context), "static");
});

test("resolves a Templater expression when Templater is installed", async () => {
    const app = appWithTemplater(async (_config, content) => `resolved(${content})`);
    const entry: RequiredPropertySchema = {
        property: "region",
        identityValue: null,
        defaultValue: "<% tp.date.now() %>",
    };
    assert.equal(await resolveRequiredPropertyValue(app, entry, context), "resolved(<% tp.date.now() %>)");
});

test("falls back to the raw expanded string and warns when Templater is not installed", async (t) => {
    const warn = t.mock.method(console, "warn", () => {});
    const entry: RequiredPropertySchema = {
        property: "region",
        identityValue: null,
        defaultValue: "<% tp.date.now() %>",
    };

    assert.equal(await resolveRequiredPropertyValue(appWithoutTemplater, entry, context), "<% tp.date.now() %>");
    assert.equal(warn.mock.calls.length, 1);
});

test("falls back to the raw expanded string and warns when Templater throws", async (t) => {
    const warn = t.mock.method(console, "warn", () => {});
    const app = appWithTemplater(async () => {
        throw new Error("boom");
    });
    const entry: RequiredPropertySchema = {
        property: "region",
        identityValue: null,
        defaultValue: "<% tp.date.now() %>",
    };

    assert.equal(await resolveRequiredPropertyValue(app, entry, context), "<% tp.date.now() %>");
    assert.equal(warn.mock.calls.length, 1);
});
