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
