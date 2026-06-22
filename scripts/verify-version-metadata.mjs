import { readFileSync } from "fs";

function readJson(filePath) {
    return JSON.parse(readFileSync(filePath, "utf8"));
}

const packageJson = readJson("package.json");
const manifest = readJson("manifest.json");
const versions = readJson("versions.json");

const errors = [];

if (packageJson.version !== manifest.version) {
    errors.push(
        `package.json version (${packageJson.version}) must match manifest.json version (${manifest.version}).`
    );
}

if (!manifest.minAppVersion) {
    errors.push("manifest.json must define minAppVersion.");
}

if (!Object.prototype.hasOwnProperty.call(versions, manifest.version)) {
    errors.push(`versions.json must include a key for ${manifest.version}.`);
} else if (versions[manifest.version] !== manifest.minAppVersion) {
    errors.push(
        `versions.json[${manifest.version}] (${versions[manifest.version]}) must match manifest.json minAppVersion (${manifest.minAppVersion}).`
    );
}

const semver = /^\d+\.\d+\.\d+$/;
if (!semver.test(manifest.version)) {
    errors.push(`manifest.json version (${manifest.version}) must be semver without a v prefix.`);
}

if (errors.length > 0) {
    console.error("Version metadata verification failed.");
    for (const error of errors) {
        console.error(`- ${error}`);
    }
    process.exit(1);
}

console.log(`Verified plugin version metadata for ${manifest.version}.`);
