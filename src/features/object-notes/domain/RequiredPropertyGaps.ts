import type { ContextSourceSettings } from "./ContextSourceSettings";
import type { RequiredPropertySchema } from "./RequiredPropertySchema";

/**
 * A present-but-falsy value (false, 0, "") satisfies the schema — only an absent key is a gap.
 */
export function computeRequiredPropertyGaps(
    source: Pick<ContextSourceSettings, "requiredProperties">,
    currentProperties: Record<string, unknown> | undefined,
): RequiredPropertySchema[] {
    return source.requiredProperties.filter((entry) => currentProperties?.[entry.property] === undefined);
}
