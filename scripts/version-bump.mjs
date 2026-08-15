import { readFileSync, writeFileSync } from "node:fs";

function readJson(filePath) {
    return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
    writeFileSync(filePath, `${JSON.stringify(data, null, 4)}\n`);
}

const targetVersion = process.env.npm_package_version;
if (!targetVersion) {
    console.error("npm_package_version is not set; run this via `pnpm version`, not directly.");
    process.exit(1);
}

const manifest = readJson("manifest.json");
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeJson("manifest.json", manifest);

const versions = readJson("versions.json");
versions[targetVersion] = minAppVersion;
writeJson("versions.json", versions);

console.log(`Synced manifest.json and versions.json to ${targetVersion}.`);
