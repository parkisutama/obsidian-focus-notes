import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const sourceRoot = path.resolve(import.meta.dirname, "../src");
const featuresRoot = path.join(sourceRoot, "features");

async function findDomainModules(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = await Promise.all(
        entries.map(async (entry) => {
            const entryPath = path.join(directory, entry.name);
            if (entry.isDirectory()) return findDomainModules(entryPath);
            return entry.isFile() && entry.name.endsWith(".ts") && directory.split(path.sep).includes("domain")
                ? [entryPath]
                : [];
        }),
    );
    return files.flat();
}

async function findTypeScriptModules(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = await Promise.all(
        entries.map(async (entry) => {
            const entryPath = path.join(directory, entry.name);
            if (entry.isDirectory()) return findTypeScriptModules(entryPath);
            return entry.isFile() && entry.name.endsWith(".ts") ? [entryPath] : [];
        }),
    );
    return files.flat();
}

function resolveRelativeModule(importer: string, specifier: string, modules: ReadonlySet<string>): string | null {
    if (!specifier.startsWith(".")) return null;
    const unresolved = path.resolve(path.dirname(importer), specifier);
    for (const candidate of [unresolved, `${unresolved}.ts`, path.join(unresolved, "index.ts")]) {
        if (modules.has(candidate)) return candidate;
    }
    return null;
}

function findImportSpecifiers(source: string): string[] {
    const specifiers: string[] = [];
    const importPattern = /\b(?:import|export)\s+(?:type\s+)?(?:[\w*{},\s]+\s+from\s+)?["']([^"']+)["']/g;
    for (const match of source.matchAll(importPattern)) specifiers.push(match[1]);
    return specifiers;
}

test("feature domain modules stay independent of Obsidian and outer layers", async () => {
    const domainModules = await findDomainModules(featuresRoot);
    assert.ok(domainModules.length > 0, "expected at least one feature domain module");

    for (const modulePath of domainModules) {
        const source = await readFile(modulePath, "utf8");
        const relativePath = path.relative(sourceRoot, modulePath);
        assert.doesNotMatch(source, /from\s+["']obsidian["']/, `${relativePath} imports Obsidian`);
        assert.doesNotMatch(
            source,
            /from\s+["'][^"']*(?:\/|\\)types(?:\.ts)?["']/,
            `${relativePath} imports central types`,
        );
        assert.doesNotMatch(
            source,
            /from\s+["'][^"']*(?:\/|\\)(?:ui|infrastructure|plugin)(?:\/|\\)/,
            `${relativePath} imports an outer layer`,
        );
    }
});

test("source modules contain no circular relative imports", async () => {
    const modules = await findTypeScriptModules(sourceRoot);
    const moduleSet = new Set(modules);
    const graph = new Map<string, string[]>();
    for (const modulePath of modules) {
        const source = await readFile(modulePath, "utf8");
        const dependencies = findImportSpecifiers(source)
            .map((specifier) => resolveRelativeModule(modulePath, specifier, moduleSet))
            .filter((dependency): dependency is string => dependency !== null);
        graph.set(modulePath, dependencies);
    }

    const visited = new Set<string>();
    const active = new Set<string>();
    const stack: string[] = [];
    const visit = (modulePath: string): void => {
        if (active.has(modulePath)) {
            const cycleStart = stack.indexOf(modulePath);
            const cycle = [...stack.slice(cycleStart), modulePath]
                .map((entry) => path.relative(sourceRoot, entry))
                .join(" -> ");
            assert.fail(`circular source import: ${cycle}`);
        }
        if (visited.has(modulePath)) return;

        active.add(modulePath);
        stack.push(modulePath);
        for (const dependency of graph.get(modulePath) ?? []) visit(dependency);
        stack.pop();
        active.delete(modulePath);
        visited.add(modulePath);
    };

    for (const modulePath of modules) visit(modulePath);
});
