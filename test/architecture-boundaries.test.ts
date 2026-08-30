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

const expectedRootModulesDuringMigration = new Set([
    "ActiveNoteLedger.ts",
    "ActiveNoteManagerLauncher.ts",
    "ActiveNoteManagerModal.ts",
    "ActiveNoteManagerModel.ts",
    "ContextSourceSettings.ts",
    "DesktopScheduledItemForm.ts",
    "DesktopScheduledItemFormModel.ts",
    "EventTaskCaptureLauncher.ts",
    "EventTaskFormState.ts",
    "EventTaskMobileScreen.ts",
    "EventTaskModal.ts",
    "InboxDesktopForm.ts",
    "InboxFolderSettings.ts",
    "InboxMarkdown.ts",
    "InboxMobileForm.ts",
    "InboxNotesController.ts",
    "InboxNotesText.ts",
    "InboxRichText.ts",
    "InboxSuggestions.ts",
    "InboxTarget.ts",
    "MobileFormPolicy.ts",
    "MobileScheduledItemForm.ts",
    "MobileScheduledItemFormModel.ts",
    "MobileViewport.ts",
    "MoodReference.ts",
    "NoteWriter.ts",
    "RecentEntriesReader.ts",
    "ScheduledItemDesktopCreateModal.ts",
    "ScheduledItemDesktopEditModal.ts",
    "ScheduledItemEditor.ts",
    "ScheduledItemIndexer.ts",
    "ScheduledItemMentionIndex.ts",
    "ScheduledItemMobileCreateLauncher.ts",
    "ScheduledItemMobileCreateScreen.ts",
    "ScheduledItemMobileEditScreen.ts",
    "ScheduledItemQuery.ts",
    "SubmissionPolicy.ts",
    "SuggestionSelection.ts",
    "TargetResolver.ts",
    "TaskFormatPreviewModal.ts",
    "TimelineGrid.ts",
    "TimelineItemModal.ts",
    "TimelineItemModalModel.ts",
    "TimelineLayout.ts",
    "TimelineSourceAlignment.ts",
    "TimelineSourceGroups.ts",
    "TimelineSourceSidebar.ts",
    "TimelineView.ts",
    "TimerView.ts",
    "main.ts",
]);

function normalizeArchitecturePath(filePath: string): string {
    return filePath.replaceAll("\\", "/");
}

function architectureImportViolation(importer: string, specifier: string): string | null {
    const normalizedImporter = normalizeArchitecturePath(importer);
    const resolvedSpecifier = specifier.startsWith(".")
        ? path.posix.normalize(path.posix.join(path.posix.dirname(normalizedImporter), specifier))
        : specifier;
    const importerIsLegacy = normalizedImporter.startsWith("legacy/");

    if (!importerIsLegacy && resolvedSpecifier.startsWith("legacy/")) {
        return "production modules must not import legacy modules";
    }
    if (normalizedImporter.startsWith("shared/") && resolvedSpecifier.startsWith("features/")) {
        return "shared modules must not import feature modules";
    }
    if (normalizedImporter.includes("/domain/")) {
        if (specifier === "obsidian") return "domain modules must not import Obsidian";
        if (
            resolvedSpecifier.startsWith("plugin/") ||
            resolvedSpecifier.startsWith("infrastructure/") ||
            /\/(?:ui|application|infrastructure|plugin)(?:\/|$)/.test(resolvedSpecifier)
        ) {
            return "domain modules must not import an outer layer";
        }
    }
    return null;
}

test("root TypeScript modules match the shrinking migration inventory", async () => {
    const entries = await readdir(sourceRoot, { withFileTypes: true });
    const actualRootModules = entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
        .map((entry) => entry.name)
        .sort();
    assert.deepEqual(actualRootModules, [...expectedRootModulesDuringMigration].sort());
});

test("source imports respect architecture layer boundaries", async () => {
    const modules = await findTypeScriptModules(sourceRoot);
    for (const modulePath of modules) {
        const relativePath = normalizeArchitecturePath(path.relative(sourceRoot, modulePath));
        const source = await readFile(modulePath, "utf8");
        for (const specifier of findImportSpecifiers(source)) {
            const violation = architectureImportViolation(relativePath, specifier);
            assert.equal(violation, null, `${relativePath} imports ${specifier}: ${violation}`);
        }
    }
});

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

test("architecture import classifier rejects inward, shared-to-feature, and legacy dependencies", () => {
    assert.match(
        architectureImportViolation("features/timeline/domain/Timeline.ts", "obsidian") ?? "",
        /domain.*Obsidian/,
    );
    assert.match(
        architectureImportViolation("features/timeline/domain/Timeline.ts", "../ui/TimelineView") ?? "",
        /domain.*outer layer/,
    );
    assert.match(
        architectureImportViolation("shared/markdown/MarkdownLink.ts", "../../features/capture/domain/CaptureTarget") ??
            "",
        /shared.*feature/,
    );
    assert.match(
        architectureImportViolation("features/timeline/ui/TimelineView.ts", "../../../legacy/EventEditModal") ?? "",
        /production.*legacy/,
    );
    assert.equal(
        architectureImportViolation("features/capture/scheduled-item/domain/ScheduledItemParser.ts", "./ScheduledItem"),
        null,
    );
});
