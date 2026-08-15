import type { EventTaskSubmissionResult } from "./EventTaskSubmission";

export class SubmissionPolicy {
    private inFlight = false;
    private completed = false;

    run(operation: () => Promise<EventTaskSubmissionResult>): Promise<EventTaskSubmissionResult> | null {
        if (this.inFlight || this.completed) return null;

        this.inFlight = true;
        return Promise.resolve()
            .then(operation)
            .then((result) => {
                if (result.status !== "failure") {
                    this.completed = true;
                }
                return result;
            })
            .finally(() => {
                this.inFlight = false;
            });
    }
}
