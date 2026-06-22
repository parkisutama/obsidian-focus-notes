import { accessSync, constants, statSync } from "fs";
import path from "path";

const REQUIRED_BUILD_ARTIFACTS = ["main.js", "manifest.json", "styles.css"];

const missing = [];
const empty = [];

for (const artifact of REQUIRED_BUILD_ARTIFACTS) {
    const artifactPath = path.join(process.cwd(), artifact);

    try {
        accessSync(artifactPath, constants.R_OK);
        if (statSync(artifactPath).size === 0) {
            empty.push(artifact);
        }
    } catch {
        missing.push(artifact);
    }
}

if (missing.length > 0 || empty.length > 0) {
    console.error("Build artifact verification failed.");
    if (missing.length > 0) {
        console.error(`Missing: ${missing.join(", ")}`);
    }
    if (empty.length > 0) {
        console.error(`Empty: ${empty.join(", ")}`);
    }
    process.exit(1);
}

console.log(`Verified build artifacts: ${REQUIRED_BUILD_ARTIFACTS.join(", ")}`);
