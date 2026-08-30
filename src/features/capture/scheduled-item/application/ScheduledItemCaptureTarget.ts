import type { FocusTarget } from "../../domain/CaptureTarget.ts";
import type { InsertPosition } from "../../../../shared/markdown/InsertPosition.ts";

export function resolveEventCaptureTarget(
    periodicalTarget: FocusTarget | null,
    settings: { heading: string; position: InsertPosition },
    explicitTargetFile?: string,
): FocusTarget {
    return {
        file: explicitTargetFile ?? periodicalTarget?.file ?? "",
        heading: settings.heading || periodicalTarget?.heading || "",
        position: settings.position,
    };
}
