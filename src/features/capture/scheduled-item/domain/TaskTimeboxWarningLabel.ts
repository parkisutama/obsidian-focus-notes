import type { TaskTimeboxWarning } from "./TaskTimebox.ts";

/** One concise, user-facing sentence per warning, joined for display under a timebox form. */
export function describeTaskTimeboxWarnings(warnings: readonly TaskTimeboxWarning[]): string {
    return warnings
        .map((warning) =>
            warning.type === "overlap"
                ? "Overlaps another timebox on this Task."
                : `Scheduled after the Task's due date (${warning.due}).`,
        )
        .join(" ");
}
