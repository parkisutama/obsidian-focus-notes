import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";
import fs from "fs";
import path from "path";

const banner = `/* Auto-generated bundle. Do not edit directly. */`;
const prod = process.argv[2] === "production";

function loadEnvFile(filePath = ".env") {
    if (!fs.existsSync(filePath)) return;

    const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
    for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        const eqIndex = trimmed.indexOf("=");
        if (eqIndex === -1) continue;

        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();
        if (!key || process.env[key] !== undefined) continue;

        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        process.env[key] = value;
    }
}

loadEnvFile();

const copyToVaultPlugin = {
    name: "copy-to-vault",
    setup(build) {
        build.onEnd(result => {
            if (result.errors.length > 0) return;

            const vaultPath = process.env.OBSIDIAN_VAULT_PLUGIN_PATH;
            if (!vaultPath) {
                console.log("OBSIDIAN_VAULT_PLUGIN_PATH is not set; skipping vault copy.");
                return;
            }

            const resolvedVaultPath = path.resolve(vaultPath);
            const filesToCopy = ["manifest.json", "main.js", "styles.css"];

            if (!fs.existsSync(resolvedVaultPath)) {
                fs.mkdirSync(resolvedVaultPath, { recursive: true });
                console.log(`Created vault plugin directory: ${resolvedVaultPath}`);
            }

            let copiedCount = 0;

            for (const file of filesToCopy) {
                if (!fs.existsSync(file)) {
                    console.log(`Build artifact not found, skipping: ${file}`);
                    continue;
                }

                try {
                    fs.copyFileSync(file, path.join(resolvedVaultPath, file));
                    copiedCount += 1;
                    console.log(`Copied ${file} to vault.`);
                } catch (error) {
                    console.warn(`Unable to copy ${file} to vault: ${error.message}`);
                }
            }

            console.log(`Copied ${copiedCount}/${filesToCopy.length} build artifacts to Obsidian vault.`);
        });
    }
};

const ctx = await esbuild.context({
    banner: { js: banner },
    entryPoints: ["src/main.ts"],
    bundle: true,
    external: [
        "obsidian",
        "electron",
        "@codemirror/autocomplete",
        "@codemirror/collab",
        "@codemirror/commands",
        "@codemirror/language",
        "@codemirror/lint",
        "@codemirror/search",
        "@codemirror/state",
        "@codemirror/view",
        "@lezer/common",
        "@lezer/highlight",
        "@lezer/lr",
        ...builtins
    ],
    format: "cjs",
    target: "es2018",
    logLevel: "info",
    sourcemap: prod ? false : "inline",
    treeShaking: true,
    outfile: "main.js",
    minify: prod,
    plugins: [copyToVaultPlugin]
});

if (prod) {
    await ctx.rebuild();
    process.exit(0);
} else {
    await ctx.watch();
}
