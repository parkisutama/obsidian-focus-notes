import type { App, TFile } from "obsidian";

/** Minimal shape this plugin needs from Templater's undocumented public API. */
export interface TemplaterApi {
    parseTemplate(template: string): Promise<string>;
}

interface TemplaterRunningConfig {
    __brand: "TemplaterRunningConfig";
}

interface TemplaterPluginApi {
    create_running_config: (templateFile: TFile, targetFile: TFile, runMode: number) => TemplaterRunningConfig;
    parse_template: (runningConfig: TemplaterRunningConfig, content: string) => Promise<string>;
}

interface TemplaterPlugin {
    templater?: TemplaterPluginApi;
}

/**
 * Templater is a soft dependency: never added to package.json, only probed at runtime through
 * its plugin instance. Templater's internal RunMode enum has no stable published contract across
 * versions, so 4 (DynamicProcessor in the versions this was checked against) is used as the mode
 * meant for parsing a value on demand rather than creating or overwriting a file.
 */
const DYNAMIC_PROCESSOR_RUN_MODE = 4;

export function getTemplaterApi(app: App, targetFile: TFile): TemplaterApi | null {
    const plugins = (app as unknown as { plugins?: { plugins?: Record<string, unknown> } }).plugins?.plugins;
    const templater = (plugins?.["templater-obsidian"] as TemplaterPlugin | undefined)?.templater;
    if (typeof templater?.create_running_config !== "function" || typeof templater?.parse_template !== "function") {
        return null;
    }
    return {
        async parseTemplate(template: string): Promise<string> {
            const runningConfig = templater.create_running_config(targetFile, targetFile, DYNAMIC_PROCESSOR_RUN_MODE);
            return templater.parse_template(runningConfig, template);
        },
    };
}
